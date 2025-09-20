import React from "react"
import { ListChecks, LayoutList, Settings, CheckCheck } from "lucide-react"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { AutoApproveSetting, autoApproveSettingsConfig } from "../settings/AutoApproveToggle"
import { useAutoApprovalToggles } from "@/hooks/useAutoApprovalToggles"

interface AutoApproveDropdownProps {
	disabled?: boolean
	triggerClassName?: string
}

export const AutoApproveDropdown = ({ disabled = false, triggerClassName = "" }: AutoApproveDropdownProps) => {
	const [open, setOpen] = React.useState(false)
	const portalContainer = useRooPortal("roo-portal")
	const { t } = useAppTranslation()

	const {
		autoApprovalEnabled,
		setAutoApprovalEnabled,
		alwaysApproveResubmit,
		setAlwaysAllowReadOnly,
		setAlwaysAllowWrite,
		setAlwaysAllowExecute,
		setAlwaysAllowBrowser,
		setAlwaysAllowMcp,
		setAlwaysAllowModeSwitch,
		setAlwaysAllowSubtasks,
		setAlwaysApproveResubmit,
		setAlwaysAllowFollowupQuestions,
		setAlwaysAllowUpdateTodoList,
	} = useExtensionState()

	const baseToggles = useAutoApprovalToggles()

	// Include alwaysApproveResubmit in addition to the base toggles
	const toggles = React.useMemo(
		() => ({
			...baseToggles,
			alwaysApproveResubmit: alwaysApproveResubmit,
		}),
		[baseToggles, alwaysApproveResubmit],
	)

	const onAutoApproveToggle = React.useCallback(
		(key: AutoApproveSetting, value: boolean) => {
			vscode.postMessage({ type: key, bool: value })

			// Update the specific toggle state
			switch (key) {
				case "alwaysAllowReadOnly":
					setAlwaysAllowReadOnly(value)
					break
				case "alwaysAllowWrite":
					setAlwaysAllowWrite(value)
					break
				case "alwaysAllowExecute":
					setAlwaysAllowExecute(value)
					break
				case "alwaysAllowBrowser":
					setAlwaysAllowBrowser(value)
					break
				case "alwaysAllowMcp":
					setAlwaysAllowMcp(value)
					break
				case "alwaysAllowModeSwitch":
					setAlwaysAllowModeSwitch(value)
					break
				case "alwaysAllowSubtasks":
					setAlwaysAllowSubtasks(value)
					break
				case "alwaysApproveResubmit":
					setAlwaysApproveResubmit(value)
					break
				case "alwaysAllowFollowupQuestions":
					setAlwaysAllowFollowupQuestions(value)
					break
				case "alwaysAllowUpdateTodoList":
					setAlwaysAllowUpdateTodoList(value)
					break
			}

			// If enabling any option, ensure autoApprovalEnabled is true
			if (value && !autoApprovalEnabled) {
				setAutoApprovalEnabled(true)
				vscode.postMessage({ type: "autoApprovalEnabled", bool: true })
			}
		},
		[
			autoApprovalEnabled,
			setAlwaysAllowReadOnly,
			setAlwaysAllowWrite,
			setAlwaysAllowExecute,
			setAlwaysAllowBrowser,
			setAlwaysAllowMcp,
			setAlwaysAllowModeSwitch,
			setAlwaysAllowSubtasks,
			setAlwaysApproveResubmit,
			setAlwaysAllowFollowupQuestions,
			setAlwaysAllowUpdateTodoList,
			setAutoApprovalEnabled,
		],
	)

	const handleSelectAll = React.useCallback(() => {
		// Enable all options
		Object.keys(autoApproveSettingsConfig).forEach((key) => {
			onAutoApproveToggle(key as AutoApproveSetting, true)
		})
		// Enable master auto-approval
		if (!autoApprovalEnabled) {
			setAutoApprovalEnabled(true)
			vscode.postMessage({ type: "autoApprovalEnabled", bool: true })
		}
	}, [onAutoApproveToggle, autoApprovalEnabled, setAutoApprovalEnabled])

	const handleSelectNone = React.useCallback(() => {
		// Disable all options
		Object.keys(autoApproveSettingsConfig).forEach((key) => {
			onAutoApproveToggle(key as AutoApproveSetting, false)
		})
		// Disable master auto-approval
		if (autoApprovalEnabled) {
			setAutoApprovalEnabled(false)
			vscode.postMessage({ type: "autoApprovalEnabled", bool: false })
		}
	}, [onAutoApproveToggle, autoApprovalEnabled, setAutoApprovalEnabled])

	const handleOpenSettings = React.useCallback(
		() =>
			window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "autoApprove" } }),
		[],
	)

	// Calculate enabled and total counts as separate properties
	const enabledCount = React.useMemo(() => {
		return Object.values(toggles).filter((value) => !!value).length
	}, [toggles])

	const totalCount = React.useMemo(() => {
		return Object.keys(toggles).length
	}, [toggles])

	// Split settings into two columns
	const settingsArray = Object.values(autoApproveSettingsConfig)
	const halfLength = Math.ceil(settingsArray.length / 2)
	const firstColumn = settingsArray.slice(0, halfLength)
	const secondColumn = settingsArray.slice(halfLength)

	return (
		<Popover open={open} onOpenChange={setOpen} data-testid="auto-approve-dropdown-root">
			<StandardTooltip content={t("chat:autoApprove.tooltip")}>
				<PopoverTrigger
					disabled={disabled}
					data-testid="auto-approve-dropdown-trigger"
					className={cn(
						"inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
						"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
						"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
						disabled
							? "opacity-50 cursor-not-allowed"
							: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
						triggerClassName,
					)}>
					<CheckCheck className="size-3 flex-shrink-0" />
					<span className="truncate min-w-0">
						{enabledCount === totalCount
							? t("chat:autoApprove.triggerLabelAll")
							: t("chat:autoApprove.triggerLabel", { count: enabledCount })}
					</span>
				</PopoverTrigger>
			</StandardTooltip>
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden min-w-96 max-w-9/10"
				onOpenAutoFocus={(e) => e.preventDefault()}>
				<div className="flex flex-col w-full">
					{/* Header with description */}
					<div className="p-3 border-b border-vscode-dropdown-border">
						<div className="flex items-center justify-between gap-1 pr-1 pb-2">
							<h4 className="m-0 font-bold text-base text-vscode-foreground">
								{t("chat:autoApprove.title")}
							</h4>
							<Settings
								className="inline mb-0.5 mr-1 size-4 cursor-pointer"
								onClick={handleOpenSettings}
							/>
						</div>
						<p className="m-0 text-xs text-vscode-descriptionForeground">
							{t("chat:autoApprove.description")}
						</p>
					</div>

					{/* Two-column layout for approval options */}
					<div className="p-3">
						<div className="grid grid-cols-2 gap-x-4 gap-y-2">
							{/* First Column */}
							<div className="space-y-2">
								{firstColumn.map(({ key, labelKey, descriptionKey, icon }) => {
									const isEnabled = toggles[key]
									return (
										<StandardTooltip key={key} content={t(descriptionKey)}>
											<button
												onClick={() => onAutoApproveToggle(key, !isEnabled)}
												className={cn(
													"w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left",
													"transition-all duration-150",
													"hover:bg-vscode-list-hoverBackground",
													isEnabled
														? "bg-vscode-button-background text-vscode-button-foreground"
														: "bg-transparent text-vscode-foreground opacity-70 hover:opacity-100",
												)}
												data-testid={`auto-approve-${key}`}>
												<span className={`codicon codicon-${icon} text-sm flex-shrink-0`} />
												<span className="flex-1 truncate">{t(labelKey)}</span>
												{isEnabled && (
													<span className="codicon codicon-check text-xs flex-shrink-0" />
												)}
											</button>
										</StandardTooltip>
									)
								})}
							</div>

							{/* Second Column */}
							<div className="space-y-2">
								{secondColumn.map(({ key, labelKey, descriptionKey, icon }) => {
									const isEnabled = toggles[key]
									return (
										<StandardTooltip key={key} content={t(descriptionKey)}>
											<button
												onClick={() => onAutoApproveToggle(key, !isEnabled)}
												className={cn(
													"w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left",
													"transition-all duration-150",
													"hover:bg-vscode-list-hoverBackground",
													isEnabled
														? "bg-vscode-button-background text-vscode-button-foreground"
														: "bg-transparent text-vscode-foreground opacity-70 hover:opacity-100",
												)}
												data-testid={`auto-approve-${key}`}>
												<span className={`codicon codicon-${icon} text-sm flex-shrink-0`} />
												<span className="flex-1 truncate">{t(labelKey)}</span>
												{isEnabled && (
													<span className="codicon codicon-check text-xs flex-shrink-0" />
												)}
											</button>
										</StandardTooltip>
									)
								})}
							</div>
						</div>
					</div>

					{/* Bottom bar with Select All/None buttons */}
					<div className="flex flex-row items-center justify-between px-2 py-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							<button
								aria-label={t("chat:autoApprove.selectAll")}
								onClick={handleSelectAll}
								className={cn(
									"relative inline-flex items-center justify-center gap-1",
									"bg-transparent border-none px-2 py-1",
									"rounded-md text-base font-bold",
									"text-vscode-foreground",
									"transition-all duration-150",
									"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
									"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
									"active:bg-[rgba(255,255,255,0.1)]",
									"cursor-pointer",
								)}>
								<ListChecks className="w-3.5 h-3.5" />
								<span>{t("chat:autoApprove.all")}</span>
							</button>
							<button
								aria-label={t("chat:autoApprove.selectNone")}
								onClick={handleSelectNone}
								className={cn(
									"relative inline-flex items-center justify-center gap-1",
									"bg-transparent border-none px-2 py-1",
									"rounded-md text-base font-bold",
									"text-vscode-foreground",
									"transition-all duration-150",
									"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
									"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
									"active:bg-[rgba(255,255,255,0.1)]",
									"cursor-pointer",
								)}>
								<LayoutList className="w-3.5 h-3.5" />
								<span>{t("chat:autoApprove.none")}</span>
							</button>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
