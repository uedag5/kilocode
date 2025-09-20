import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { getKiloCodeBackendSignInUrl } from "../../helpers"
import { Button } from "@src/components/ui"
import { type ProviderSettings, type OrganizationAllowList } from "@roo-code/types"
import type { RouterModels } from "@roo/api"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { inputEventTransform } from "../../../settings/transforms"
import { ModelPicker } from "../../../settings/ModelPicker"
import { vscode } from "@src/utils/vscode"
import { OrganizationSelector } from "../../common/OrganizationSelector"
import { KiloCodeWrapperProperties } from "../../../../../../src/shared/kilocode/wrapper"
import { useKiloIdentity } from "@src/utils/kilocode/useKiloIdentity"

type KiloCodeProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	currentApiConfigName?: string
	hideKiloCodeButton?: boolean
	routerModels?: RouterModels
	organizationAllowList: OrganizationAllowList
	uriScheme: string | undefined
	kiloCodeWrapperProperties: KiloCodeWrapperProperties | undefined
	uiKind: string | undefined
	kilocodeDefaultModel: string
}

export const KiloCode = ({
	apiConfiguration,
	setApiConfigurationField,
	currentApiConfigName,
	hideKiloCodeButton,
	routerModels,
	organizationAllowList,
	uriScheme,
	uiKind,
	kiloCodeWrapperProperties,
	kilocodeDefaultModel,
}: KiloCodeProps) => {
	const { t } = useAppTranslation()
	
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

	// Use the existing hook to get user identity
	const userIdentity = useKiloIdentity(apiConfiguration.kilocodeToken || "", "")
	const isKiloCodeAiUser = userIdentity.endsWith("@kilocode.ai")

	const areKilocodeWarningsDisabled = apiConfiguration.kilocodeTesterWarningsDisabledUntil
		? apiConfiguration.kilocodeTesterWarningsDisabledUntil > Date.now()
		: false

	const handleToggleTesterWarnings = useCallback(() => {
		const newTimestamp = Date.now() + (areKilocodeWarningsDisabled ? 0 : 24 * 60 * 60 * 1000)
		setApiConfigurationField("kilocodeTesterWarningsDisabledUntil", newTimestamp)
	}, [areKilocodeWarningsDisabled, setApiConfigurationField])

	return (
		<>
			<div>
				<label className="block font-medium -mb-2">{t("kilocode:settings.provider.account")}</label>
			</div>
			{!hideKiloCodeButton &&
				(apiConfiguration.kilocodeToken ? (
					<div>
						<Button
							variant="secondary"
							onClick={async () => {
								setApiConfigurationField("kilocodeToken", "")

								vscode.postMessage({
									type: "upsertApiConfiguration",
									text: currentApiConfigName,
									apiConfiguration: {
										...apiConfiguration,
										kilocodeToken: "",
										kilocodeOrganizationId: undefined,
									},
								})
							}}>
							{t("kilocode:settings.provider.logout")}
						</Button>
					</div>
				) : (
					<VSCodeButtonLink
						variant="secondary"
						href={getKiloCodeBackendSignInUrl(uriScheme, uiKind, kiloCodeWrapperProperties)}>
						{t("kilocode:settings.provider.login")}
					</VSCodeButtonLink>
				))}

			<VSCodeTextField
				value={apiConfiguration?.kilocodeToken || ""}
				type="password"
				onInput={handleInputChange("kilocodeToken")}
				placeholder={t("kilocode:settings.provider.apiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("kilocode:settings.provider.apiKey")}</label>
				</div>
			</VSCodeTextField>

			<OrganizationSelector showLabel />

			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={kilocodeDefaultModel}
				models={routerModels?.["kilocode-openrouter"] ?? {}}
				modelIdKey="kilocodeModel"
				serviceName="Kilo Code"
				serviceUrl="https://kilocode.ai"
				organizationAllowList={organizationAllowList}
			/>

			{/* KILOCODE-TESTER warnings setting - only visible for @kilocode.ai users */}
			{isKiloCodeAiUser && (
				<div className="mb-4">
					<label className="block font-medium mb-2">Disable KILOCODE-TESTER warnings</label>
					<div className="text-sm text-vscode-descriptionForeground mb-2">
						{areKilocodeWarningsDisabled
							? `Warnings disabled until ${new Date(apiConfiguration.kilocodeTesterWarningsDisabledUntil || 0).toLocaleString()}`
							: "KILOCODE-TESTER warnings are currently enabled"}
					</div>
					<Button variant="secondary" onClick={handleToggleTesterWarnings} className="text-sm">
						{areKilocodeWarningsDisabled ? "Enable warnings now" : "Disable warnings for 1 day"}
					</Button>
				</div>
			)}
		</>
	)
}
