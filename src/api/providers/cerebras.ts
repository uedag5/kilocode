import { Anthropic } from "@anthropic-ai/sdk"

import { type CerebrasModelId, cerebrasDefaultModelId, cerebrasModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../shared/api"
import { calculateApiCostOpenAI } from "../../shared/cost"
import { ApiStream } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { XmlMatcher } from "../../utils/xml-matcher"

import type { ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { BaseProvider } from "./base-provider"
import { DEFAULT_HEADERS } from "./constants"
import { t } from "../../i18n"

const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1"
const CEREBRAS_DEFAULT_TEMPERATURE = 0
const MAX_BACKOFF_DELAY_MS = 120_000
const BACKOFF_JITTER_RATIO = 0.2

/**
 * Removes thinking tokens from text to prevent model confusion when processing conversation history.
 * This is crucial because models can get confused by their own thinking tokens in input.
 */
function stripThinkingTokens(text: string): string {
	// Remove <think>...</think> blocks entirely, including nested ones
	return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim()
}

/**
 * Flattens OpenAI message content to simple strings that Cerebras can handle.
 * Cerebras doesn't support complex content arrays like OpenAI does.
 */
function flattenMessageContent(content: any): string {
	if (typeof content === "string") {
		return content
	}

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === "string") {
					return part
				}
				if (part.type === "text") {
					return part.text || ""
				}
				if (part.type === "image_url") {
					return "[Image]" // Placeholder for images since Cerebras doesn't support images
				}
				return ""
			})
			.filter(Boolean)
			.join("\n")
	}

	// Fallback for any other content types
	return String(content || "")
}

/**
 * Converts OpenAI messages to Cerebras-compatible format with simple string content.
 * Also strips thinking tokens from assistant messages to prevent model confusion.
 */
function convertToCerebrasMessages(openaiMessages: any[]): Array<{ role: string; content: string }> {
	return openaiMessages
		.map((msg) => {
			let content = flattenMessageContent(msg.content)

			// Strip thinking tokens from assistant messages to prevent confusion
			if (msg.role === "assistant") {
				content = stripThinkingTokens(content)
			}

			return {
				role: msg.role,
				content,
			}
		})
		.filter((msg) => msg.content.trim() !== "") // Remove empty messages
}

export class CerebrasHandler extends BaseProvider implements SingleCompletionHandler {
	private apiKey: string
	private providerModels: typeof cerebrasModels
	private defaultProviderModelId: CerebrasModelId
	private options: ApiHandlerOptions
	private maxRetries: number
	private retryDelay: number
	private lastUsage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 }

	constructor(options: ApiHandlerOptions) {
		super()
		this.options = options
		this.apiKey = options.cerebrasApiKey || ""
		this.providerModels = cerebrasModels
		this.defaultProviderModelId = cerebrasDefaultModelId
		this.maxRetries = options.modelMaxRetries ?? 5
		this.retryDelay = options.modelRetryDelay ?? 1000

		if (!this.apiKey) {
			throw new Error("Cerebras API key is required")
		}
	}

	/**
	 * Fetches the API with retry logic for rate limiting.
	 * @param url - The URL to fetch
	 * @param options - Fetch options
	 * @param retryCount - Current retry count (default: 0)
	 * @returns The fetch response
	 */
	private async fetchWithRetry(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
		const response = await fetch(url, options)

		if (response.status === 429 && retryCount < this.maxRetries - 1) {
			const waitTime = this.getRetryWaitTime(response.headers, retryCount)

			// Wait for the specified time before retrying
			await new Promise((resolve) => setTimeout(resolve, waitTime))

			// Retry the request
			return this.fetchWithRetry(url, options, retryCount + 1)
		}

		return response
	}

	private getRetryWaitTime(headers: Headers, retryCount: number): number {
		const cerebrasReset = this.parseCerebrasResetHeader(headers)
		if (cerebrasReset !== null) {
			return cerebrasReset
		}

		const retryAfter = this.parseRetryAfterHeader(headers)
		if (retryAfter !== null) {
			return retryAfter
		}

		return this.calculateBackoffDelay(retryCount)
	}

	private parseCerebrasResetHeader(headers: Headers): number | null {
		const headerNames = [
			"x-ratelimit-reset-tokens-minute",
			"x-ratelimit-reset-requests-minute",
			"x-ratelimit-reset-tokens-second",
			"x-ratelimit-reset-requests-second",
		]

		for (const name of headerNames) {
			const value = headers.get(name)
			if (!value) {
				continue
			}

			const seconds = Number.parseFloat(value)
			if (Number.isNaN(seconds) || seconds < 0) {
				continue
			}

			return Math.max(0, seconds * 1000 + 1000)
		}

		return null
	}

	private parseRetryAfterHeader(headers: Headers): number | null {
		const retryAfter = headers.get("retry-after")
		if (!retryAfter) {
			return null
		}

		const seconds = Number(retryAfter)
		if (Number.isFinite(seconds) && seconds >= 0) {
			return Math.max(this.retryDelay, seconds * 1000)
		}

		const parsedDate = Date.parse(retryAfter)
		if (!Number.isNaN(parsedDate)) {
			const delta = parsedDate - Date.now()
			if (delta > 0) {
				return Math.max(this.retryDelay, delta)
			}
		}

		return null
	}

	private calculateBackoffDelay(retryCount: number): number {
		const exponential = Math.min(this.retryDelay * 2 ** retryCount, MAX_BACKOFF_DELAY_MS)
		const jitterRange = exponential * BACKOFF_JITTER_RATIO
		const jitter = jitterRange * (Math.random() * 2 - 1)
		const waitTime = Math.round(exponential + jitter)
		return Math.max(this.retryDelay, waitTime)
	}

	getModel(): { id: CerebrasModelId; info: (typeof cerebrasModels)[CerebrasModelId] } {
		const originalModelId = (this.options.apiModelId as CerebrasModelId) || this.defaultProviderModelId

		// Route both qwen coder models to the same actual model ID for API calls
		// This allows them to have different rate limits/descriptions in the UI
		// while using the same underlying model
		let apiModelId = originalModelId
		if (originalModelId === "qwen-3-coder-480b-free") {
			apiModelId = "qwen-3-coder-480b"
		}

		return {
			id: apiModelId,
			info: this.providerModels[originalModelId], // Use original model info for rate limits/descriptions
		}
	}

	async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const {
			id: model,
			info: { maxTokens: max_tokens },
		} = this.getModel()
		const temperature = this.options.modelTemperature ?? CEREBRAS_DEFAULT_TEMPERATURE

		// Convert Anthropic messages to OpenAI format, then flatten for Cerebras
		// This will automatically strip thinking tokens from assistant messages
		const openaiMessages = convertToOpenAiMessages(messages)
		const cerebrasMessages = convertToCerebrasMessages(openaiMessages)

		// Prepare request body following Cerebras API specification exactly
		const requestBody = {
			model,
			messages: [{ role: "system", content: systemPrompt }, ...cerebrasMessages],
			stream: true,
			// Use max_completion_tokens (Cerebras-specific parameter)
			...(max_tokens && max_tokens > 0 && max_tokens <= 32768 ? { max_completion_tokens: max_tokens } : {}),
			// Clamp temperature to Cerebras range (0 to 1.5)
			...(temperature !== undefined && temperature !== CEREBRAS_DEFAULT_TEMPERATURE
				? {
						temperature: Math.max(0, Math.min(1.5, temperature)),
					}
				: {}),
		}

		try {
			const response = await this.fetchWithRetry(`${CEREBRAS_BASE_URL}/chat/completions`, {
				method: "POST",
				headers: {
					...DEFAULT_HEADERS,
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()

				let errorMessage = "Unknown error"
				try {
					const errorJson = JSON.parse(errorText)
					errorMessage = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson, null, 2)
				} catch {
					errorMessage = errorText || `HTTP ${response.status}`
				}

				// Provide more actionable error messages
				if (response.status === 401) {
					throw new Error(t("common:errors.cerebras.authenticationFailed"))
				} else if (response.status === 403) {
					throw new Error(t("common:errors.cerebras.accessForbidden"))
				} else if (response.status === 429) {
					throw new Error(t("common:errors.cerebras.rateLimitExceeded"))
				} else if (response.status >= 500) {
					throw new Error(t("common:errors.cerebras.serverError", { status: response.status }))
				} else {
					throw new Error(
						t("common:errors.cerebras.genericError", { status: response.status, message: errorMessage }),
					)
				}
			}

			if (!response.body) {
				throw new Error(t("common:errors.cerebras.noResponseBody"))
			}

			// Initialize XmlMatcher to parse <think>...</think> tags
			const matcher = new XmlMatcher(
				"think",
				(chunk) =>
					({
						type: chunk.matched ? "reasoning" : "text",
						text: chunk.data,
					}) as const,
			)

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ""
			let inputTokens = 0
			let outputTokens = 0

			try {
				while (true) {
					const { done, value } = await reader.read()
					if (done) break

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split("\n")
					buffer = lines.pop() || "" // Keep the last incomplete line in the buffer

					for (const line of lines) {
						if (line.trim() === "") continue

						try {
							if (line.startsWith("data: ")) {
								const jsonStr = line.slice(6).trim()
								if (jsonStr === "[DONE]") {
									continue
								}

								const parsed = JSON.parse(jsonStr)

								// Handle text content - parse for thinking tokens
								if (parsed.choices?.[0]?.delta?.content) {
									const content = parsed.choices[0].delta.content

									// Use XmlMatcher to parse <think>...</think> tags
									for (const chunk of matcher.update(content)) {
										yield chunk
									}
								}

								// Handle usage information if available
								if (parsed.usage) {
									inputTokens = parsed.usage.prompt_tokens || 0
									outputTokens = parsed.usage.completion_tokens || 0
								}
							}
						} catch (error) {
							// Silently ignore malformed streaming data lines
						}
					}
				}
			} finally {
				reader.releaseLock()
			}

			// Process any remaining content in the matcher
			for (const chunk of matcher.final()) {
				yield chunk
			}

			// Provide token usage estimate if not available from API
			if (inputTokens === 0 || outputTokens === 0) {
				const inputText = systemPrompt + cerebrasMessages.map((m) => m.content).join("")
				inputTokens = inputTokens || Math.ceil(inputText.length / 4) // Rough estimate: 4 chars per token
				outputTokens = outputTokens || Math.ceil((max_tokens || 1000) / 10) // Rough estimate
			}

			// Store usage for cost calculation
			this.lastUsage = { inputTokens, outputTokens }

			yield {
				type: "usage",
				inputTokens,
				outputTokens,
			}
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(t("common:errors.cerebras.completionError", { error: error.message }))
			}
			throw error
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: model } = this.getModel()

		// Prepare request body for non-streaming completion
		const requestBody = {
			model,
			messages: [{ role: "user", content: prompt }],
			stream: false,
		}

		try {
			const response = await this.fetchWithRetry(`${CEREBRAS_BASE_URL}/chat/completions`, {
				method: "POST",
				headers: {
					...DEFAULT_HEADERS,
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()

				// Provide consistent error handling with createMessage
				if (response.status === 401) {
					throw new Error(t("common:errors.cerebras.authenticationFailed"))
				} else if (response.status === 403) {
					throw new Error(t("common:errors.cerebras.accessForbidden"))
				} else if (response.status === 429) {
					throw new Error(t("common:errors.cerebras.rateLimitExceeded"))
				} else if (response.status >= 500) {
					throw new Error(t("common:errors.cerebras.serverError", { status: response.status }))
				} else {
					throw new Error(
						t("common:errors.cerebras.genericError", { status: response.status, message: errorText }),
					)
				}
			}

			const result = await response.json()
			return result.choices?.[0]?.message?.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(t("common:errors.cerebras.completionError", { error: error.message }))
			}
			throw error
		}
	}

	getApiCost(metadata: ApiHandlerCreateMessageMetadata): number {
		const { info } = this.getModel()
		// Use actual token usage from the last request
		const { inputTokens, outputTokens } = this.lastUsage
		return calculateApiCostOpenAI(info, inputTokens, outputTokens)
	}
}
