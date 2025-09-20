import { Anthropic } from "@anthropic-ai/sdk"
import { Message, Ollama } from "ollama"
import { ModelInfo, openAiModelInfoSaneDefaults, DEEP_SEEK_DEFAULT_TEMPERATURE } from "@roo-code/types"
import { ApiStream } from "../transform/stream"
import { BaseProvider } from "./base-provider"
import type { ApiHandlerOptions } from "../../shared/api"
import { getOllamaModels } from "./fetchers/ollama"
import { XmlMatcher } from "../../utils/xml-matcher"
import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"

// kilocode_change start
import { fetchWithTimeout } from "./kilocode/fetchWithTimeout"
const OLLAMA_TIMEOUT_MS = 3_600_000

const TOKEN_ESTIMATION_FACTOR = 4 //Industry standard technique for estimating token counts without actually implementing a parser/tokenizer

function estimateOllamaTokenCount(messages: Message[]): number {
	const totalChars = messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0)
	return Math.ceil(totalChars / TOKEN_ESTIMATION_FACTOR)
}
// kilocode_change end

function convertToOllamaMessages(anthropicMessages: Anthropic.Messages.MessageParam[]): Message[] {
	const ollamaMessages: Message[] = []

	for (const anthropicMessage of anthropicMessages) {
		if (typeof anthropicMessage.content === "string") {
			ollamaMessages.push({
				role: anthropicMessage.role,
				content: anthropicMessage.content,
			})
		} else {
			if (anthropicMessage.role === "user") {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolResultBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_result") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						}
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process tool result messages FIRST since they must follow the tool use messages
				const toolResultImages: string[] = []
				toolMessages.forEach((toolMessage) => {
					// The Anthropic SDK allows tool results to be a string or an array of text and image blocks, enabling rich and structured content. In contrast, the Ollama SDK only supports tool results as a single string, so we map the Anthropic tool result parts into one concatenated string to maintain compatibility.
					let content: string

					if (typeof toolMessage.content === "string") {
						content = toolMessage.content
					} else {
						content =
							toolMessage.content
								?.map((part) => {
									if (part.type === "image") {
										// Handle base64 images only (Anthropic SDK uses base64)
										// Ollama expects raw base64 strings, not data URLs
										if ("source" in part && part.source.type === "base64") {
											toolResultImages.push(part.source.data)
										}
										return "(see following user message for image)"
									}
									return part.text
								})
								.join("\n") ?? ""
					}
					ollamaMessages.push({
						role: "user",
						images: toolResultImages.length > 0 ? toolResultImages : undefined,
						content: content,
					})
				})

				// Process non-tool messages
				if (nonToolMessages.length > 0) {
					// Separate text and images for Ollama
					const textContent = nonToolMessages
						.filter((part) => part.type === "text")
						.map((part) => part.text)
						.join("\n")

					const imageData: string[] = []
					nonToolMessages.forEach((part) => {
						if (part.type === "image" && "source" in part && part.source.type === "base64") {
							// Ollama expects raw base64 strings, not data URLs
							imageData.push(part.source.data)
						}
					})

					ollamaMessages.push({
						role: "user",
						content: textContent,
						images: imageData.length > 0 ? imageData : undefined,
					})
				}
			} else if (anthropicMessage.role === "assistant") {
				const { nonToolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolUseBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_use") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						} // assistant cannot send tool_result messages
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process non-tool messages
				let content: string = ""
				if (nonToolMessages.length > 0) {
					content = nonToolMessages
						.map((part) => {
							if (part.type === "image") {
								return "" // impossible as the assistant cannot send images
							}
							return part.text
						})
						.join("\n")
				}

				ollamaMessages.push({
					role: "assistant",
					content,
				})
			}
		}
	}

	return ollamaMessages
}

export class NativeOllamaHandler extends BaseProvider implements SingleCompletionHandler {
	protected options: ApiHandlerOptions
	private client: Ollama | undefined
	protected models: Record<string, ModelInfo> = {}
	private isInitialized = false // kilocode_change

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.initialize() // kilocode_change
	}

	// kilocode_change start
	private async initialize(): Promise<void> {
		if (this.isInitialized) {
			return
		}
		await this.fetchModel()
		this.isInitialized = true
	}
	// kilocode_change end

	private ensureClient(): Ollama {
		if (!this.client) {
			try {
				// kilocode_change start
				const headers = this.options.ollamaApiKey
					? { Authorization: this.options.ollamaApiKey } // Yes, this is weird, its not a Bearer token
					: undefined
				// kilocode_change end

				this.client = new Ollama({
					host: this.options.ollamaBaseUrl || "http://localhost:11434",
					// kilocode_change start
					fetch: fetchWithTimeout(OLLAMA_TIMEOUT_MS, headers),
					headers: headers,
					// kilocode_change end
				})
			} catch (error: any) {
				throw new Error(`Error creating Ollama client: ${error.message}`)
			}
		}
		return this.client
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		// kilocode_change start
		if (!this.isInitialized) {
			await this.initialize()
		}
		// kilocode_change end

		const client = this.ensureClient()
		const { id: modelId, info: modelInfo } = this.getModel() // kilocode_change: fetchModel => getModel
		const useR1Format = modelId.toLowerCase().includes("deepseek-r1")

		const ollamaMessages: Message[] = [
			{ role: "system", content: systemPrompt },
			...convertToOllamaMessages(messages),
		]

		// kilocode_change start
		const estimatedTokenCount = estimateOllamaTokenCount(ollamaMessages)
		if (modelInfo.maxTokens && estimatedTokenCount > modelInfo.maxTokens) {
			throw new Error(
				`Input message is too long for the selected model. Estimated tokens: ${estimatedTokenCount}, Max tokens: ${modelInfo.maxTokens}. To increase the context window size, see: https://kilocode.ai/docs/providers/ollama#configure-the-context-size`,
			)
		}
		// kilocode_change end

		const matcher = new XmlMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		try {
			// Create the actual API request promise
			const stream = await client.chat({
				model: modelId,
				messages: ollamaMessages,
				stream: true,
				options: {
					temperature: this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				},
			})

			let totalInputTokens = 0
			let totalOutputTokens = 0

			try {
				for await (const chunk of stream) {
					if (typeof chunk.message.content === "string") {
						// Process content through matcher for reasoning detection
						for (const matcherChunk of matcher.update(chunk.message.content)) {
							yield matcherChunk
						}
					}

					// Handle token usage if available
					if (chunk.eval_count !== undefined || chunk.prompt_eval_count !== undefined) {
						if (chunk.prompt_eval_count) {
							totalInputTokens = chunk.prompt_eval_count
						}
						if (chunk.eval_count) {
							totalOutputTokens = chunk.eval_count
						}
					}
				}

				// Yield any remaining content from the matcher
				for (const chunk of matcher.final()) {
					yield chunk
				}

				// Yield usage information if available
				if (totalInputTokens > 0 || totalOutputTokens > 0) {
					yield {
						type: "usage",
						inputTokens: totalInputTokens,
						outputTokens: totalOutputTokens,
					}
				}
			} catch (streamError: any) {
				console.error("Error processing Ollama stream:", streamError)
				throw new Error(`Ollama stream processing error: ${streamError.message || "Unknown error"}`)
			}
		} catch (error: any) {
			// Enhance error reporting
			const statusCode = error.status || error.statusCode
			const errorMessage = error.message || "Unknown error"

			if (error.code === "ECONNREFUSED") {
				throw new Error(
					`Ollama service is not running at ${this.options.ollamaBaseUrl || "http://localhost:11434"}. Please start Ollama first.`,
				)
			} else if (statusCode === 404) {
				throw new Error(
					`Model ${this.getModel().id} not found in Ollama. Please pull the model first with: ollama pull ${this.getModel().id}`,
				)
			}

			console.error(`Ollama API error (${statusCode || "unknown"}): ${errorMessage}`)
			throw error
		}
	}

	async fetchModel() {
		this.models = await getOllamaModels(this.options.ollamaBaseUrl, this.options.ollamaApiKey)
		return this.models // kilocode_change
	}

	override getModel(): { id: string; info: ModelInfo } {
		const modelId = this.options.ollamaModelId || ""

		// kilocode_change start
		const modelInfo = this.models[modelId]
		if (!modelInfo) {
			const availableModels = Object.keys(this.models)
			const errorMessage =
				availableModels.length > 0
					? `Model ${modelId} not found. Available models: ${availableModels.join(", ")}`
					: `Model ${modelId} not found. No models available.`
			throw new Error(errorMessage)
		}
		// kilocode_change end

		return {
			id: modelId,
			info: modelInfo, // kilocode_change
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		try {
			// kilocode_change start
			if (!this.isInitialized) {
				await this.initialize()
			}
			// kilocode_change end

			const client = this.ensureClient()
			const { id: modelId } = this.getModel() // kilocode_change: fetchModel => getModel
			const useR1Format = modelId.toLowerCase().includes("deepseek-r1")

			const response = await client.chat({
				model: modelId,
				messages: [{ role: "user", content: prompt }],
				stream: false,
				options: {
					temperature: this.options.modelTemperature ?? (useR1Format ? DEEP_SEEK_DEFAULT_TEMPERATURE : 0),
				},
			})

			return response.message?.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Ollama completion error: ${error.message}`)
			}
			throw error
		}
	}
}
