import { useState, useCallback, useMemo, useEffect } from "react"
import { useEvent } from "react-use"
import { VSCodeTextField, VSCodeRadioGroup, VSCodeRadio } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@roo-code/types"

import { ExtensionMessage } from "@roo/ExtensionMessage"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useRouterModels } from "@src/components/ui/hooks/useRouterModels"
import { vscode } from "@src/utils/vscode"

import { inputEventTransform } from "../transforms"
import { ModelRecord } from "@roo/api"

type OllamaProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
}

export const Ollama = ({ apiConfiguration, setApiConfigurationField }: OllamaProps) => {
	const { t } = useAppTranslation()

	const [ollamaModels, setOllamaModels] = useState<ModelRecord>({})
	const [showApiKey, setShowApiKey] = useState(false) // kilocode_change added
	const routerModels = useRouterModels({ ollamaBaseUrl: apiConfiguration.ollamaBaseUrl }) // kilocode_change query key

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const onMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		switch (message.type) {
			case "ollamaModels":
				{
					const newModels = message.ollamaModels ?? {}
					setOllamaModels(newModels)
				}
				break
		}
	}, [])

	useEvent("message", onMessage)

	// Refresh models on mount
	useEffect(() => {
		// Request fresh models - the handler now flushes cache automatically
		vscode.postMessage({ type: "requestOllamaModels" })
	}, [])

	// Check if the selected model exists in the fetched models
	const modelNotAvailable = useMemo(() => {
		const selectedModel = apiConfiguration?.ollamaModelId
		if (!selectedModel) return false

		// Check if model exists in local ollama models
		if (Object.keys(ollamaModels).length > 0 && selectedModel in ollamaModels) {
			return false // Model is available locally
		}

		// If we have router models data for Ollama
		if (routerModels.data?.ollama) {
			const availableModels = Object.keys(routerModels.data.ollama)
			// Show warning if model is not in the list (regardless of how many models there are)
			return !availableModels.includes(selectedModel)
		}

		// If neither source has loaded yet, don't show warning
		return false
	}, [apiConfiguration?.ollamaModelId, routerModels.data, ollamaModels])

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.ollamaBaseUrl || ""}
				type="url"
				onInput={handleInputChange("ollamaBaseUrl")}
				placeholder={t("settings:defaults.ollamaUrl")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.ollama.baseUrl")}</label>
			</VSCodeTextField>
			{
				// kilocode_change start
				<>
					<div className="relative">
						<VSCodeTextField
							value={apiConfiguration?.ollamaApiKey || ""}
							type={showApiKey ? "text" : "password"}
							onInput={handleInputChange("ollamaApiKey")}
							placeholder={t("settings:providers.ollama.apiKeyPlaceholder")}
							className="w-full pr-10">
							<label className="block font-medium mb-1">
								{t("settings:providers.ollama.apiKeyInfo")}{" "}
								<span className="text-vscode-descriptionForeground font-normal">
									({t("settings:optional")})
								</span>
							</label>
						</VSCodeTextField>
						<button
							type="button"
							onClick={() => setShowApiKey(!showApiKey)}
							className="absolute right-3 top-8 text-vscode-foreground hover:text-vscode-descriptionForeground focus:outline-none">
							{showApiKey ? (
								<span className="codicon codicon-eye" />
							) : (
								<span className="codicon codicon-eye-closed" />
							)}
						</button>
					</div>
					<div className="text-sm text-vscode-descriptionForeground mb-2">
						{t("settings:providers.ollama.apiKeyInfo")}
					</div>
				</>
				// kilocode_change end
			}
			<VSCodeTextField
				value={apiConfiguration?.ollamaModelId || ""}
				onInput={handleInputChange("ollamaModelId")}
				placeholder={t("settings:placeholders.modelId.ollama")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.ollama.modelId")}</label>
			</VSCodeTextField>
			{modelNotAvailable && (
				<div className="flex flex-col gap-2 text-vscode-errorForeground text-sm">
					<div className="flex flex-row items-center gap-1">
						<div className="codicon codicon-close" />
						<div>
							{t("settings:validation.modelAvailability", { modelId: apiConfiguration?.ollamaModelId })}
						</div>
					</div>
				</div>
			)}
			{Object.keys(ollamaModels).length > 0 && (
				<VSCodeRadioGroup
					value={
						(apiConfiguration?.ollamaModelId || "") in ollamaModels ? apiConfiguration?.ollamaModelId : ""
					}
					onChange={handleInputChange("ollamaModelId")}>
					{Object.keys(ollamaModels).map((model) => (
						<VSCodeRadio key={model} value={model} checked={apiConfiguration?.ollamaModelId === model}>
							{model}
						</VSCodeRadio>
					))}
				</VSCodeRadioGroup>
			)}
			<div className="text-sm text-vscode-descriptionForeground">
				{t("settings:providers.ollama.description")}
				<span className="text-vscode-errorForeground ml-1">{t("settings:providers.ollama.warning")}</span>
			</div>
		</>
	)
}
