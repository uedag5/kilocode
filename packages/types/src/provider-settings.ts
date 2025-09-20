import { z } from "zod"

import { modelInfoSchema, reasoningEffortWithMinimalSchema, verbosityLevelsSchema, serviceTierSchema } from "./model.js"
import { codebaseIndexProviderSchema } from "./codebase-index.js"
import {
	anthropicModels,
	bedrockModels,
	cerebrasModels,
	chutesModels,
	claudeCodeModels,
	deepSeekModels,
	doubaoModels,
	featherlessModels,
	fireworksModels,
	geminiModels,
	groqModels,
	ioIntelligenceModels,
	mistralModels,
	moonshotModels,
	openAiNativeModels,
	qwenCodeModels,
	rooModels,
	sambaNovaModels,
	vertexModels,
	vscodeLlmModels,
	xaiModels,
	internationalZAiModels,
} from "./providers/index.js"

/**
 * ProviderName
 */

export const providerNames = [
	"anthropic",
	"claude-code",
	"glama",
	"openrouter",
	"bedrock",
	"vertex",
	"openai",
	"ollama",
	"vscode-lm",
	"lmstudio",
	"gemini",
	"openai-native",
	"mistral",
	"moonshot",
	"deepseek",
	"deepinfra",
	"doubao",
	"qwen-code",
	"unbound",
	"requesty",
	"human-relay",
	"fake-ai",
	"xai",
	"groq",
	"chutes",
	"litellm",
	// kilocode_change start
	"kilocode",
	"gemini-cli",
	"virtual-quota-fallback",
	// kilocode_change end
	"huggingface",
	"cerebras",
	"sambanova",
	"zai",
	"fireworks",
	"featherless",
	"io-intelligence",
	"roo",
	"vercel-ai-gateway",
] as const

export const providerNamesSchema = z.enum(providerNames)

export type ProviderName = z.infer<typeof providerNamesSchema>

/**
 * ProviderSettingsEntry
 */

export const providerSettingsEntrySchema = z.object({
	id: z.string(),
	name: z.string(),
	apiProvider: providerNamesSchema.optional(),
	modelId: z.string().optional(),
})

export type ProviderSettingsEntry = z.infer<typeof providerSettingsEntrySchema>

/**
 * ProviderSettings
 */

/**
 * Default value for consecutive mistake limit
 */
export const DEFAULT_CONSECUTIVE_MISTAKE_LIMIT = 3

const baseProviderSettingsSchema = z.object({
	includeMaxTokens: z.boolean().optional(),
	diffEnabled: z.boolean().optional(),
	todoListEnabled: z.boolean().optional(),
	fuzzyMatchThreshold: z.number().optional(),
	modelTemperature: z.number().nullish(),
	rateLimitSeconds: z.number().optional(),
	consecutiveMistakeLimit: z.number().min(0).optional(),

	// Model reasoning.
	enableReasoningEffort: z.boolean().optional(),
	reasoningEffort: reasoningEffortWithMinimalSchema.optional(),
	modelMaxTokens: z.number().optional(),
	modelMaxThinkingTokens: z.number().optional(),

	// Model verbosity.
	verbosity: verbosityLevelsSchema.optional(),
})

// Several of the providers share common model config properties.
const apiModelIdProviderModelSchema = baseProviderSettingsSchema.extend({
	apiModelId: z.string().optional(),
})

const anthropicSchema = apiModelIdProviderModelSchema.extend({
	apiKey: z.string().optional(),
	anthropicBaseUrl: z.string().optional(),
	anthropicUseAuthToken: z.boolean().optional(),
	anthropicBeta1MContext: z.boolean().optional(), // Enable 'context-1m-2025-08-07' beta for 1M context window
})

const claudeCodeSchema = apiModelIdProviderModelSchema.extend({
	claudeCodePath: z.string().optional(),
	claudeCodeMaxOutputTokens: z.number().int().min(1).max(200000).optional(),
})

const glamaSchema = baseProviderSettingsSchema.extend({
	glamaModelId: z.string().optional(),
	glamaApiKey: z.string().optional(),
})

// kilocode_change start
export const openRouterProviderDataCollectionSchema = z.enum(["allow", "deny"])
export const openRouterProviderSortSchema = z.enum(["price", "throughput", "latency"])
// kilocode_change end

const openRouterSchema = baseProviderSettingsSchema.extend({
	openRouterApiKey: z.string().optional(),
	openRouterModelId: z.string().optional(),
	openRouterBaseUrl: z.string().optional(),
	openRouterSpecificProvider: z.string().optional(),
	openRouterUseMiddleOutTransform: z.boolean().optional(),
	// kilocode_change start
	openRouterProviderDataCollection: openRouterProviderDataCollectionSchema.optional(),
	openRouterProviderSort: openRouterProviderSortSchema.optional(),
	// kilocode_change end
})

const bedrockSchema = apiModelIdProviderModelSchema.extend({
	awsAccessKey: z.string().optional(),
	awsSecretKey: z.string().optional(),
	awsSessionToken: z.string().optional(),
	awsRegion: z.string().optional(),
	awsUseCrossRegionInference: z.boolean().optional(),
	awsUsePromptCache: z.boolean().optional(),
	awsProfile: z.string().optional(),
	awsUseProfile: z.boolean().optional(),
	awsApiKey: z.string().optional(),
	awsUseApiKey: z.boolean().optional(),
	awsCustomArn: z.string().optional(),
	awsModelContextWindow: z.number().optional(),
	awsBedrockEndpointEnabled: z.boolean().optional(),
	awsBedrockEndpoint: z.string().optional(),
	awsBedrock1MContext: z.boolean().optional(), // Enable 'context-1m-2025-08-07' beta for 1M context window
})

const vertexSchema = apiModelIdProviderModelSchema.extend({
	vertexKeyFile: z.string().optional(),
	vertexJsonCredentials: z.string().optional(),
	vertexProjectId: z.string().optional(),
	vertexRegion: z.string().optional(),
	enableUrlContext: z.boolean().optional(),
	enableGrounding: z.boolean().optional(),
})

const openAiSchema = baseProviderSettingsSchema.extend({
	openAiBaseUrl: z.string().optional(),
	openAiApiKey: z.string().optional(),
	openAiLegacyFormat: z.boolean().optional(),
	openAiR1FormatEnabled: z.boolean().optional(),
	openAiModelId: z.string().optional(),
	openAiCustomModelInfo: modelInfoSchema.nullish(),
	openAiUseAzure: z.boolean().optional(),
	azureApiVersion: z.string().optional(),
	openAiStreamingEnabled: z.boolean().optional(),
	openAiHostHeader: z.string().optional(), // Keep temporarily for backward compatibility during migration.
	openAiHeaders: z.record(z.string(), z.string()).optional(),
})

const ollamaSchema = baseProviderSettingsSchema.extend({
	ollamaModelId: z.string().optional(),
	ollamaBaseUrl: z.string().optional(),
	ollamaApiKey: z.string().optional(),
})

const vsCodeLmSchema = baseProviderSettingsSchema.extend({
	vsCodeLmModelSelector: z
		.object({
			vendor: z.string().optional(),
			family: z.string().optional(),
			version: z.string().optional(),
			id: z.string().optional(),
		})
		.optional(),
})

const lmStudioSchema = baseProviderSettingsSchema.extend({
	lmStudioModelId: z.string().optional(),
	lmStudioBaseUrl: z.string().optional(),
	lmStudioDraftModelId: z.string().optional(),
	lmStudioSpeculativeDecodingEnabled: z.boolean().optional(),
})

const geminiSchema = apiModelIdProviderModelSchema.extend({
	geminiApiKey: z.string().optional(),
	googleGeminiBaseUrl: z.string().optional(),
	enableUrlContext: z.boolean().optional(),
	enableGrounding: z.boolean().optional(),
})

// kilocode_change start
const geminiCliSchema = apiModelIdProviderModelSchema.extend({
	geminiCliOAuthPath: z.string().optional(),
	geminiCliProjectId: z.string().optional(),
})
// kilocode_change end

const openAiNativeSchema = apiModelIdProviderModelSchema.extend({
	openAiNativeApiKey: z.string().optional(),
	openAiNativeBaseUrl: z.string().optional(),
	// OpenAI Responses API service tier for openai-native provider only.
	// UI should only expose this when the selected model supports flex/priority.
	openAiNativeServiceTier: serviceTierSchema.optional(),
})

const mistralSchema = apiModelIdProviderModelSchema.extend({
	mistralApiKey: z.string().optional(),
	mistralCodestralUrl: z.string().optional(),
})

const deepSeekSchema = apiModelIdProviderModelSchema.extend({
	deepSeekBaseUrl: z.string().optional(),
	deepSeekApiKey: z.string().optional(),
})

const deepInfraSchema = apiModelIdProviderModelSchema.extend({
	deepInfraBaseUrl: z.string().optional(),
	deepInfraApiKey: z.string().optional(),
	deepInfraModelId: z.string().optional(),
})

const doubaoSchema = apiModelIdProviderModelSchema.extend({
	doubaoBaseUrl: z.string().optional(),
	doubaoApiKey: z.string().optional(),
})

const moonshotSchema = apiModelIdProviderModelSchema.extend({
	moonshotBaseUrl: z
		.union([z.literal("https://api.moonshot.ai/v1"), z.literal("https://api.moonshot.cn/v1")])
		.optional(),
	moonshotApiKey: z.string().optional(),
})

const unboundSchema = baseProviderSettingsSchema.extend({
	unboundApiKey: z.string().optional(),
	unboundModelId: z.string().optional(),
})

const requestySchema = baseProviderSettingsSchema.extend({
	requestyBaseUrl: z.string().optional(),
	requestyApiKey: z.string().optional(),
	requestyModelId: z.string().optional(),
})

const humanRelaySchema = baseProviderSettingsSchema

const fakeAiSchema = baseProviderSettingsSchema.extend({
	fakeAi: z.unknown().optional(),
})

const xaiSchema = apiModelIdProviderModelSchema.extend({
	xaiApiKey: z.string().optional(),
})

const groqSchema = apiModelIdProviderModelSchema.extend({
	groqApiKey: z.string().optional(),
})

const huggingFaceSchema = baseProviderSettingsSchema.extend({
	huggingFaceApiKey: z.string().optional(),
	huggingFaceModelId: z.string().optional(),
	huggingFaceInferenceProvider: z.string().optional(),
})

const chutesSchema = apiModelIdProviderModelSchema.extend({
	chutesApiKey: z.string().optional(),
})

const litellmSchema = baseProviderSettingsSchema.extend({
	litellmBaseUrl: z.string().optional(),
	litellmApiKey: z.string().optional(),
	litellmModelId: z.string().optional(),
	litellmUsePromptCache: z.boolean().optional(),
})

const cerebrasSchema = apiModelIdProviderModelSchema.extend({
	cerebrasApiKey: z.string().optional(),
})

const sambaNovaSchema = apiModelIdProviderModelSchema.extend({
	sambaNovaApiKey: z.string().optional(),
})

// kilocode_change start
const kilocodeSchema = baseProviderSettingsSchema.extend({
	kilocodeToken: z.string().optional(),
	kilocodeOrganizationId: z.string().optional(),
	kilocodeModel: z.string().optional(),
	openRouterSpecificProvider: z.string().optional(),
	openRouterProviderDataCollection: openRouterProviderDataCollectionSchema.optional(),
	openRouterProviderSort: openRouterProviderSortSchema.optional(),
	kilocodeTesterWarningsDisabledUntil: z.number().optional(), // Timestamp for disabling KILOCODE-TESTER warnings
})

export const virtualQuotaFallbackProfileDataSchema = z.object({
	profileName: z.string().optional(),
	profileId: z.string().optional(),
	profileLimits: z
		.object({
			tokensPerMinute: z.coerce.number().optional(),
			tokensPerHour: z.coerce.number().optional(),
			tokensPerDay: z.coerce.number().optional(),
			requestsPerMinute: z.coerce.number().optional(),
			requestsPerHour: z.coerce.number().optional(),
			requestsPerDay: z.coerce.number().optional(),
		})
		.optional(),
})

const virtualQuotaFallbackSchema = baseProviderSettingsSchema.extend({
	profiles: z.array(virtualQuotaFallbackProfileDataSchema).optional(),
})

export const zaiApiLineSchema = z.enum(["international_coding", "international", "china_coding", "china"])

export type ZaiApiLine = z.infer<typeof zaiApiLineSchema>
// kilocode_change end

const zaiSchema = apiModelIdProviderModelSchema.extend({
	zaiApiKey: z.string().optional(),
	zaiApiLine: zaiApiLineSchema.optional(), // kilocode_change
})

const fireworksSchema = apiModelIdProviderModelSchema.extend({
	fireworksApiKey: z.string().optional(),
})

const featherlessSchema = apiModelIdProviderModelSchema.extend({
	featherlessApiKey: z.string().optional(),
})

const ioIntelligenceSchema = apiModelIdProviderModelSchema.extend({
	ioIntelligenceModelId: z.string().optional(),
	ioIntelligenceApiKey: z.string().optional(),
})

const qwenCodeSchema = apiModelIdProviderModelSchema.extend({
	qwenCodeOauthPath: z.string().optional(),
})

const rooSchema = apiModelIdProviderModelSchema.extend({
	// No additional fields needed - uses cloud authentication
})

const vercelAiGatewaySchema = baseProviderSettingsSchema.extend({
	vercelAiGatewayApiKey: z.string().optional(),
	vercelAiGatewayModelId: z.string().optional(),
})

const defaultSchema = z.object({
	apiProvider: z.undefined(),
})

export const providerSettingsSchemaDiscriminated = z.discriminatedUnion("apiProvider", [
	anthropicSchema.merge(z.object({ apiProvider: z.literal("anthropic") })),
	claudeCodeSchema.merge(z.object({ apiProvider: z.literal("claude-code") })),
	glamaSchema.merge(z.object({ apiProvider: z.literal("glama") })),
	openRouterSchema.merge(z.object({ apiProvider: z.literal("openrouter") })),
	bedrockSchema.merge(z.object({ apiProvider: z.literal("bedrock") })),
	vertexSchema.merge(z.object({ apiProvider: z.literal("vertex") })),
	openAiSchema.merge(z.object({ apiProvider: z.literal("openai") })),
	ollamaSchema.merge(z.object({ apiProvider: z.literal("ollama") })),
	vsCodeLmSchema.merge(z.object({ apiProvider: z.literal("vscode-lm") })),
	lmStudioSchema.merge(z.object({ apiProvider: z.literal("lmstudio") })),
	geminiSchema.merge(z.object({ apiProvider: z.literal("gemini") })),
	openAiNativeSchema.merge(z.object({ apiProvider: z.literal("openai-native") })),
	mistralSchema.merge(z.object({ apiProvider: z.literal("mistral") })),
	deepSeekSchema.merge(z.object({ apiProvider: z.literal("deepseek") })),
	deepInfraSchema.merge(z.object({ apiProvider: z.literal("deepinfra") })),
	doubaoSchema.merge(z.object({ apiProvider: z.literal("doubao") })),
	moonshotSchema.merge(z.object({ apiProvider: z.literal("moonshot") })),
	unboundSchema.merge(z.object({ apiProvider: z.literal("unbound") })),
	requestySchema.merge(z.object({ apiProvider: z.literal("requesty") })),
	humanRelaySchema.merge(z.object({ apiProvider: z.literal("human-relay") })),
	fakeAiSchema.merge(z.object({ apiProvider: z.literal("fake-ai") })),
	xaiSchema.merge(z.object({ apiProvider: z.literal("xai") })),
	// kilocode_change start
	geminiCliSchema.merge(z.object({ apiProvider: z.literal("gemini-cli") })),
	kilocodeSchema.merge(z.object({ apiProvider: z.literal("kilocode") })),
	virtualQuotaFallbackSchema.merge(z.object({ apiProvider: z.literal("virtual-quota-fallback") })),
	// kilocode_change end
	groqSchema.merge(z.object({ apiProvider: z.literal("groq") })),
	huggingFaceSchema.merge(z.object({ apiProvider: z.literal("huggingface") })),
	chutesSchema.merge(z.object({ apiProvider: z.literal("chutes") })),
	litellmSchema.merge(z.object({ apiProvider: z.literal("litellm") })),
	cerebrasSchema.merge(z.object({ apiProvider: z.literal("cerebras") })),
	sambaNovaSchema.merge(z.object({ apiProvider: z.literal("sambanova") })),
	zaiSchema.merge(z.object({ apiProvider: z.literal("zai") })),
	fireworksSchema.merge(z.object({ apiProvider: z.literal("fireworks") })),
	featherlessSchema.merge(z.object({ apiProvider: z.literal("featherless") })),
	ioIntelligenceSchema.merge(z.object({ apiProvider: z.literal("io-intelligence") })),
	qwenCodeSchema.merge(z.object({ apiProvider: z.literal("qwen-code") })),
	rooSchema.merge(z.object({ apiProvider: z.literal("roo") })),
	vercelAiGatewaySchema.merge(z.object({ apiProvider: z.literal("vercel-ai-gateway") })),
	defaultSchema,
])

export const providerSettingsSchema = z.object({
	apiProvider: providerNamesSchema.optional(),
	...anthropicSchema.shape,
	...claudeCodeSchema.shape,
	...glamaSchema.shape,
	...openRouterSchema.shape,
	...bedrockSchema.shape,
	...vertexSchema.shape,
	...openAiSchema.shape,
	...ollamaSchema.shape,
	...vsCodeLmSchema.shape,
	...lmStudioSchema.shape,
	...geminiSchema.shape,
	// kilocode_change start
	...geminiCliSchema.shape,
	...kilocodeSchema.shape,
	...virtualQuotaFallbackSchema.shape,
	// kilocode_change end
	...openAiNativeSchema.shape,
	...mistralSchema.shape,
	...deepSeekSchema.shape,
	...deepInfraSchema.shape,
	...doubaoSchema.shape,
	...moonshotSchema.shape,
	...unboundSchema.shape,
	...requestySchema.shape,
	...humanRelaySchema.shape,
	...fakeAiSchema.shape,
	...xaiSchema.shape,
	...groqSchema.shape,
	...huggingFaceSchema.shape,
	...chutesSchema.shape,
	...litellmSchema.shape,
	...cerebrasSchema.shape,
	...sambaNovaSchema.shape,
	...zaiSchema.shape,
	...fireworksSchema.shape,
	...featherlessSchema.shape,
	...ioIntelligenceSchema.shape,
	...qwenCodeSchema.shape,
	...rooSchema.shape,
	...vercelAiGatewaySchema.shape,
	...codebaseIndexProviderSchema.shape,
})

export type ProviderSettings = z.infer<typeof providerSettingsSchema>

export const providerSettingsWithIdSchema = providerSettingsSchema.extend({ id: z.string().optional() })

export const discriminatedProviderSettingsWithIdSchema = providerSettingsSchemaDiscriminated.and(
	z.object({ id: z.string().optional() }),
)

export type ProviderSettingsWithId = z.infer<typeof providerSettingsWithIdSchema>

export const PROVIDER_SETTINGS_KEYS = providerSettingsSchema.keyof().options

export const MODEL_ID_KEYS: Partial<keyof ProviderSettings>[] = [
	"apiModelId",
	"glamaModelId",
	"openRouterModelId",
	"openAiModelId",
	"ollamaModelId",
	"lmStudioModelId",
	"lmStudioDraftModelId",
	"unboundModelId",
	"requestyModelId",
	"litellmModelId",
	"huggingFaceModelId",
	"ioIntelligenceModelId",
	"vercelAiGatewayModelId",
	"deepInfraModelId",
]

export const getModelId = (settings: ProviderSettings): string | undefined => {
	const modelIdKey = MODEL_ID_KEYS.find((key) => settings[key])
	return modelIdKey ? (settings[modelIdKey] as string) : undefined
}

// Providers that use Anthropic-style API protocol.
export const ANTHROPIC_STYLE_PROVIDERS: ProviderName[] = ["anthropic", "claude-code", "bedrock"]

export const getApiProtocol = (provider: ProviderName | undefined, modelId?: string): "anthropic" | "openai" => {
	if (provider && ANTHROPIC_STYLE_PROVIDERS.includes(provider)) {
		return "anthropic"
	}

	if (provider && provider === "vertex" && modelId && modelId.toLowerCase().includes("claude")) {
		return "anthropic"
	}

	// Vercel AI Gateway uses anthropic protocol for anthropic models.
	if (provider && provider === "vercel-ai-gateway" && modelId && modelId.toLowerCase().startsWith("anthropic/")) {
		return "anthropic"
	}

	return "openai"
}

export const MODELS_BY_PROVIDER: Record<
	Exclude<ProviderName, "fake-ai" | "human-relay" | "gemini-cli" | "lmstudio" | "openai" | "ollama">,
	{ id: ProviderName; label: string; models: string[] }
> = {
	anthropic: {
		id: "anthropic",
		label: "Anthropic",
		models: Object.keys(anthropicModels),
	},
	bedrock: {
		id: "bedrock",
		label: "Amazon Bedrock",
		models: Object.keys(bedrockModels),
	},
	cerebras: {
		id: "cerebras",
		label: "Cerebras",
		models: Object.keys(cerebrasModels),
	},
	chutes: {
		id: "chutes",
		label: "Chutes AI",
		models: Object.keys(chutesModels),
	},
	"claude-code": { id: "claude-code", label: "Claude Code", models: Object.keys(claudeCodeModels) },
	deepseek: {
		id: "deepseek",
		label: "DeepSeek",
		models: Object.keys(deepSeekModels),
	},
	doubao: { id: "doubao", label: "Doubao", models: Object.keys(doubaoModels) },
	featherless: {
		id: "featherless",
		label: "Featherless",
		models: Object.keys(featherlessModels),
	},
	fireworks: {
		id: "fireworks",
		label: "Fireworks",
		models: Object.keys(fireworksModels),
	},
	gemini: {
		id: "gemini",
		label: "Google Gemini",
		models: Object.keys(geminiModels),
	},
	groq: { id: "groq", label: "Groq", models: Object.keys(groqModels) },
	"io-intelligence": {
		id: "io-intelligence",
		label: "IO Intelligence",
		models: Object.keys(ioIntelligenceModels),
	},
	mistral: {
		id: "mistral",
		label: "Mistral",
		models: Object.keys(mistralModels),
	},
	moonshot: {
		id: "moonshot",
		label: "Moonshot",
		models: Object.keys(moonshotModels),
	},
	"openai-native": {
		id: "openai-native",
		label: "OpenAI",
		models: Object.keys(openAiNativeModels),
	},
	"qwen-code": { id: "qwen-code", label: "Qwen Code", models: Object.keys(qwenCodeModels) },
	roo: { id: "roo", label: "Roo", models: Object.keys(rooModels) },
	sambanova: {
		id: "sambanova",
		label: "SambaNova",
		models: Object.keys(sambaNovaModels),
	},
	vertex: {
		id: "vertex",
		label: "GCP Vertex AI",
		models: Object.keys(vertexModels),
	},
	"vscode-lm": {
		id: "vscode-lm",
		label: "VS Code LM API",
		models: Object.keys(vscodeLlmModels),
	},
	xai: { id: "xai", label: "xAI (Grok)", models: Object.keys(xaiModels) },
	zai: { id: "zai", label: "Zai", models: Object.keys(internationalZAiModels) },

	// Dynamic providers; models pulled from the respective APIs.
	glama: { id: "glama", label: "Glama", models: [] },
	huggingface: { id: "huggingface", label: "Hugging Face", models: [] },
	litellm: { id: "litellm", label: "LiteLLM", models: [] },
	openrouter: { id: "openrouter", label: "OpenRouter", models: [] },
	requesty: { id: "requesty", label: "Requesty", models: [] },
	unbound: { id: "unbound", label: "Unbound", models: [] },

	// kilocode_change start
	kilocode: { id: "kilocode", label: "Kilocode", models: [] },
	"virtual-quota-fallback": { id: "virtual-quota-fallback", label: "Virtual Quota Fallback", models: [] },
	// kilocode_change end
	deepinfra: { id: "deepinfra", label: "DeepInfra", models: [] },
	"vercel-ai-gateway": { id: "vercel-ai-gateway", label: "Vercel AI Gateway", models: [] },
}

export const dynamicProviders = [
	"glama",
	"huggingface",
	"litellm",
	"openrouter",
	"requesty",
	"unbound",
	// kilocode_change start
	"kilocode",
	"virtual-quota-fallback",
	// kilocode_change end
	"deepinfra",
	"vercel-ai-gateway",
] as const satisfies readonly ProviderName[]

export type DynamicProvider = (typeof dynamicProviders)[number]

export const isDynamicProvider = (key: string): key is DynamicProvider =>
	dynamicProviders.includes(key as DynamicProvider)
