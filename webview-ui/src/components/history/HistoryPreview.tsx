import { memo } from "react"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

// import { useTaskSearch } from "./useTaskSearch" // kilocode_change
import TaskItem from "./TaskItem"
import { useTaskHistory } from "@/kilocode/hooks/useTaskHistory"

const HistoryPreview = ({ taskHistoryVersion }: { taskHistoryVersion: number } /*kilocode_change*/) => {
	// kilocode_change start
	const { data } = useTaskHistory(
		{
			workspace: "current",
			sort: "newest",
			favoritesOnly: false,
			pageIndex: 0,
		},
		taskHistoryVersion,
	)
	const tasks = data?.historyItems ?? []
	// kilocode_change end
	const { t } = useAppTranslation()

	const handleViewAllHistory = () => {
		vscode.postMessage({ type: "switchTab", tab: "history" })
	}

	return (
		<div className="flex flex-col gap-3">
			{tasks.length !== 0 && (
				<>
					{tasks.slice(0, 3).map((item) => (
						<TaskItem key={item.id} item={item} variant="compact" />
					))}
					<button
						onClick={handleViewAllHistory}
						className="text-base text-vscode-descriptionForeground hover:text-vscode-textLink-foreground transition-colors cursor-pointer text-center w-full"
						aria-label={t("history:viewAllHistory")}>
						{t("history:viewAllHistory")}
					</button>
				</>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
