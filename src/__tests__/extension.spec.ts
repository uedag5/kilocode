// npx vitest run __tests__/extension.spec.ts

import type * as vscode from "vscode"
import type { AuthState } from "@roo-code/types"

vi.mock("vscode", () => ({
	window: {
		createOutputChannel: vi.fn().mockReturnValue({
			appendLine: vi.fn(),
		}),
		registerWebviewViewProvider: vi.fn(),
		registerUriHandler: vi.fn(),
		tabGroups: {
			onDidChangeTabs: vi.fn(),
		},
		onDidChangeActiveTextEditor: vi.fn(),
		onDidChangeTextEditorSelection: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		createTextEditorDecorationType: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		onDidOpenTerminal: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		terminals: [],
		activeTextEditor: null,
	},
	workspace: {
		registerTextDocumentContentProvider: vi.fn(),
		getConfiguration: vi.fn().mockReturnValue({
			get: vi.fn().mockReturnValue([]),
		}),
		createFileSystemWatcher: vi.fn().mockReturnValue({
			onDidCreate: vi.fn(),
			onDidChange: vi.fn(),
			onDidDelete: vi.fn(),
			dispose: vi.fn(),
		}),
		onDidChangeWorkspaceFolders: vi.fn(),
		onDidChangeConfiguration: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		onDidChangeTextDocument: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		onDidOpenTextDocument: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
		onDidCloseTextDocument: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	languages: {
		registerCodeActionsProvider: vi.fn(),
	},
	commands: {
		executeCommand: vi.fn(),
		registerCommand: vi.fn().mockReturnValue({
			dispose: vi.fn(),
		}),
	},
	env: {
		language: "en",
		appName: "Visual Studio Code",
	},
	ExtensionMode: {
		Production: 1,
	},
	ThemeColor: vi.fn((color: any) => ({ id: color })),
	OverviewRulerLane: {
		Right: 1,
	},
	Range: vi.fn().mockImplementation((start, end) => ({
		start,
		end,
		isEmpty: vi.fn().mockReturnValue(false),
		isSingleLine: vi.fn().mockReturnValue(true),
	})),
	Uri: {
		joinPath: vi.fn().mockImplementation((...paths) => ({
			toString: () => paths.join("/"),
			path: paths.join("/"),
		})),
		parse: vi.fn().mockImplementation((uri) => ({
			toString: () => uri,
			path: uri,
		})),
		file: vi.fn().mockImplementation((path) => ({
			toString: () => `file://${path}`,
			path,
		})),
	},
	CodeActionKind: {
		QuickFix: { value: "quickfix" },
	},
	EventEmitter: vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	})),
}))

vi.mock("@dotenvx/dotenvx", () => ({
	config: vi.fn(),
}))

const mockBridgeOrchestratorDisconnect = vi.fn().mockResolvedValue(undefined)

vi.mock("@roo-code/cloud", () => ({
	CloudService: {
		createInstance: vi.fn(),
		hasInstance: vi.fn().mockReturnValue(true),
		get instance() {
			return {
				off: vi.fn(),
				on: vi.fn(),
				getUserInfo: vi.fn().mockReturnValue(null),
				isTaskSyncEnabled: vi.fn().mockReturnValue(false),
			}
		},
	},
	BridgeOrchestrator: {
		disconnect: mockBridgeOrchestratorDisconnect,
	},
	getRooCodeApiUrl: vi.fn().mockReturnValue("https://app.roocode.com"),
}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		createInstance: vi.fn().mockReturnValue({
			register: vi.fn(),
			setProvider: vi.fn(),
			shutdown: vi.fn(),
		}),
		get instance() {
			return {
				register: vi.fn(),
				setProvider: vi.fn(),
				shutdown: vi.fn(),
			}
		},
	},
	PostHogTelemetryClient: vi.fn(),
}))

vi.mock("../utils/outputChannelLogger", () => ({
	createOutputChannelLogger: vi.fn().mockReturnValue(vi.fn()),
	createDualLogger: vi.fn().mockReturnValue(vi.fn()),
}))

vi.mock("../shared/package", () => ({
	Package: {
		name: "test-extension",
		outputChannel: "Test Output",
		version: "1.0.0",
	},
}))

vi.mock("../shared/language", () => ({
	formatLanguage: vi.fn().mockReturnValue("en"),
}))

vi.mock("../core/config/ContextProxy", () => ({
	ContextProxy: {
		getInstance: vi.fn().mockResolvedValue({
			getValue: vi.fn(),
			setValue: vi.fn(),
			getValues: vi.fn().mockReturnValue({
				ghostServiceSettings: {
					enabled: true,
				},
			}),
			getProviderSettings: vi.fn().mockReturnValue({}),
		}),
		get instance() {
			return {
				getValue: vi.fn(),
				setValue: vi.fn(),
				getValues: vi.fn().mockReturnValue({
					ghostServiceSettings: {
						enabled: true,
					},
				}),
				getProviderSettings: vi.fn().mockReturnValue({}),
			}
		},
	},
}))

vi.mock("../integrations/editor/DiffViewProvider", () => ({
	DIFF_VIEW_URI_SCHEME: "test-diff-scheme",
}))

vi.mock("../integrations/terminal/TerminalRegistry", () => ({
	TerminalRegistry: {
		initialize: vi.fn(),
		cleanup: vi.fn(),
	},
}))

vi.mock("../services/mcp/McpServerManager", () => ({
	McpServerManager: {
		cleanup: vi.fn().mockResolvedValue(undefined),
		getInstance: vi.fn().mockResolvedValue(null),
		unregisterProvider: vi.fn(),
	},
}))

vi.mock("../services/code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn().mockReturnValue(null),
	},
}))

vi.mock("../services/mdm/MdmService", () => ({
	MdmService: {
		createInstance: vi.fn().mockResolvedValue(null),
	},
}))

vi.mock("../utils/migrateSettings", () => ({
	migrateSettings: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/autoImportSettings", () => ({
	autoImportSettings: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../extension/api", () => ({
	API: vi.fn().mockImplementation(() => ({})),
}))

vi.mock("../activate", () => ({
	handleUri: vi.fn(),
	registerCommands: vi.fn(),
	registerCodeActions: vi.fn(),
	registerTerminalActions: vi.fn(),
	CodeActionProvider: vi.fn().mockImplementation(() => ({
		providedCodeActionKinds: [],
	})),
}))

vi.mock("../i18n", () => ({
	initializeI18n: vi.fn(),
	t: vi.fn().mockImplementation((key, options = {}) => {
		return `mocked-translation-${key}`
	}),
}))

vi.mock("../services/ghost/GhostProvider", () => ({
	GhostProvider: {
		initialize: vi.fn().mockReturnValue({
			load: vi.fn(),
		}),
		getInstance: vi.fn().mockReturnValue(null),
		instance: null,
	},
}))

vi.mock("../services/ghost", () => ({
	registerGhostProvider: vi.fn(),
}))

vi.mock("../services/commit-message", () => ({
	registerCommitMessageProvider: vi.fn(),
}))

vi.mock("../services/terminal-welcome", () => ({
	registerWelcomeService: vi.fn(),
}))

vi.mock("../services/terminal-welcome/TerminalWelcomeService", () => ({
	TerminalWelcomeService: {
		register: vi.fn(),
	},
}))

describe("extension.ts", () => {
	let mockContext: vscode.ExtensionContext
	let authStateChangedHandler:
		| ((data: { state: AuthState; previousState: AuthState }) => void | Promise<void>)
		| undefined

	beforeEach(() => {
		vi.clearAllMocks()
		mockBridgeOrchestratorDisconnect.mockClear()

		mockContext = {
			extensionPath: "/test/path",
			globalState: {
				get: vi.fn().mockReturnValue(undefined),
				update: vi.fn(),
			},
			subscriptions: [],
		} as unknown as vscode.ExtensionContext

		authStateChangedHandler = undefined
	})

	test("authStateChangedHandler calls BridgeOrchestrator.disconnect when logged-out event fires", async () => {
		const { CloudService, BridgeOrchestrator } = await import("@roo-code/cloud")

		// Capture the auth state changed handler.
		vi.mocked(CloudService.createInstance).mockImplementation(async (_context, _logger, handlers) => {
			if (handlers?.["auth-state-changed"]) {
				authStateChangedHandler = handlers["auth-state-changed"]
			}

			return {
				off: vi.fn(),
				on: vi.fn(),
				telemetryClient: null,
			} as any
		})

		// Activate the extension.
		const { activate } = await import("../extension")
		await activate(mockContext)

		// Verify handler was registered.
		expect(authStateChangedHandler).toBeDefined()

		// Trigger logout.
		await authStateChangedHandler!({
			state: "logged-out" as AuthState,
			previousState: "logged-in" as AuthState,
		})

		// Verify BridgeOrchestrator.disconnect was called
		expect(mockBridgeOrchestratorDisconnect).toHaveBeenCalled()
	})

	test("authStateChangedHandler does not call BridgeOrchestrator.disconnect for other states", async () => {
		const { CloudService } = await import("@roo-code/cloud")

		// Capture the auth state changed handler.
		vi.mocked(CloudService.createInstance).mockImplementation(async (_context, _logger, handlers) => {
			if (handlers?.["auth-state-changed"]) {
				authStateChangedHandler = handlers["auth-state-changed"]
			}

			return {
				off: vi.fn(),
				on: vi.fn(),
				telemetryClient: null,
			} as any
		})

		// Activate the extension.
		const { activate } = await import("../extension")
		await activate(mockContext)

		// Trigger login.
		await authStateChangedHandler!({
			state: "logged-in" as AuthState,
			previousState: "logged-out" as AuthState,
		})

		// Verify BridgeOrchestrator.disconnect was NOT called.
		expect(mockBridgeOrchestratorDisconnect).not.toHaveBeenCalled()
	})
})
