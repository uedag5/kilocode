import * as vscode from "vscode"
import pWaitFor from "p-wait-for"
import { ClineProvider } from "../../webview/ClineProvider"
import { t } from "../../../i18n"
import { WebviewMessage } from "../../../shared/WebviewMessage"
import { Task } from "../../task/Task"
import axios from "axios"
import { getKiloBaseUriFromToken } from "../../../shared/kilocode/token"

// Helper function to delete messages for resending
const deleteMessagesForResend = async (cline: Task, originalMessageIndex: number, originalMessageTs: number) => {
	// Delete UI messages after the edited message
	const newClineMessages = cline.clineMessages.slice(0, originalMessageIndex)
	await cline.overwriteClineMessages(newClineMessages)

	// Delete API messages after the edited message
	const apiHistory = [...cline.apiConversationHistory]
	const timeCutoff = originalMessageTs - 1000
	const apiHistoryIndex = apiHistory.findIndex((entry) => entry.ts && entry.ts >= timeCutoff)

	if (apiHistoryIndex !== -1) {
		const newApiHistory = apiHistory.slice(0, apiHistoryIndex)
		await cline.overwriteApiConversationHistory(newApiHistory)
	}
}

// Helper function to encapsulate the common sequence of actions for resending a message
const resendMessageSequence = async (
	provider: ClineProvider,
	taskId: string,
	originalMessageIndex: number,
	originalMessageTimestamp: number,
	editedText: string,
	images?: string[],
): Promise<boolean> => {
	// 1. Get the current cline instance before deletion
	const currentCline = provider.getCurrentTask()
	if (!currentCline || currentCline.taskId !== taskId) {
		provider.log(`[Edit Message] Error: Could not get current cline instance before deletion for task ${taskId}.`)
		vscode.window.showErrorMessage(t("kilocode:userFeedback.message_update_failed"))
		return false
	}

	// 2. Delete messages using the helper
	await deleteMessagesForResend(currentCline, originalMessageIndex, originalMessageTimestamp)
	await provider.postStateToWebview()

	// 3. Re-initialize Cline with the history item (which now reflects the deleted messages)
	const { historyItem } = await provider.getTaskWithId(taskId)
	if (!historyItem) {
		provider.log(`[Edit Message] Error: Failed to retrieve history item for task ${taskId}.`)
		vscode.window.showErrorMessage(t("kilocode:userFeedback.message_update_failed"))
		return false
	}

	const newCline = await provider.createTaskWithHistoryItem(historyItem)
	if (!newCline) {
		provider.log(
			`[Edit Message] Error: Failed to re-initialize Cline with updated history item for task ${taskId}.`,
		)
		vscode.window.showErrorMessage(t("kilocode:userFeedback.message_update_failed"))
		return false
	}

	// 4. Send the edited message using the newly initialized Cline instance
	await new Promise((resolve) => setTimeout(resolve, 100)) // Add delay to mitigate race condition
	await newCline.handleWebviewAskResponse("messageResponse", editedText, images)

	return true
}

export const fetchKilocodeNotificationsHandler = async (provider: ClineProvider) => {
	try {
		const { apiConfiguration } = await provider.getState()
		const kilocodeToken = apiConfiguration?.kilocodeToken

		if (!kilocodeToken || apiConfiguration?.apiProvider !== "kilocode") {
			provider.postMessageToWebview({
				type: "kilocodeNotificationsResponse",
				notifications: [],
			})
			return
		}

		const headers: Record<string, string> = {
			Authorization: `Bearer ${kilocodeToken}`,
			"Content-Type": "application/json",
		}

		// Add X-KILOCODE-TESTER: SUPPRESS header if the setting is enabled
		if (
			apiConfiguration.kilocodeTesterWarningsDisabledUntil &&
			apiConfiguration.kilocodeTesterWarningsDisabledUntil > Date.now()
		) {
			headers["X-KILOCODE-TESTER"] = "SUPPRESS"
		}

		const response = await axios.get(`${getKiloBaseUriFromToken(kilocodeToken)}/api/users/notifications`, {
			headers,
			timeout: 5000,
		})

		provider.postMessageToWebview({
			type: "kilocodeNotificationsResponse",
			notifications: response.data?.notifications || [],
		})
	} catch (error: any) {
		provider.log(`Error fetching Kilocode notifications: ${error.message}`)
		provider.postMessageToWebview({
			type: "kilocodeNotificationsResponse",
			notifications: [],
		})
	}
}

export const editMessageHandler = async (provider: ClineProvider, message: WebviewMessage) => {
	if (!message.values?.ts || !message.values?.text) {
		return
	}
	const timestamp = message.values.ts
	const newText = message.values.text
	const revert = message.values.revert || false
	const images = message.values.images

	const currentCline = provider.getCurrentTask()
	if (!currentCline) {
		provider.log("[Edit Message] Error: No active Cline instance found.")
		return
	}

	try {
		// Find message by timestamp
		const messageIndex = currentCline.clineMessages.findIndex((msg) => msg.ts && msg.ts === timestamp)

		if (messageIndex === -1) {
			provider.log(`[Edit Message] Error: Message with timestamp ${timestamp} not found.`)
			return
		}

		if (revert) {
			// Find the most recent checkpoint before this message
			const checkpointMessage = currentCline.clineMessages
				.filter((msg) => msg.say === "checkpoint_saved")
				.filter((msg) => msg.ts && msg.ts <= timestamp)
				.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]

			if (checkpointMessage && checkpointMessage.text) {
				// Restore git shadow
				await provider.cancelTask()

				try {
					await pWaitFor(() => currentCline.isInitialized === true, { timeout: 3_000 })
				} catch (error) {
					vscode.window.showErrorMessage(t("common:errors.checkpoint_timeout"))
				}

				try {
					await currentCline.checkpointRestore({
						commitHash: checkpointMessage.text,
						ts: checkpointMessage.ts,
						mode: "preview",
					})
				} catch (error) {
					vscode.window.showErrorMessage(t("common:errors.checkpoint_failed"))
				}

				// Add delay to mitigate race condition
				await new Promise((resolve) => setTimeout(resolve, 500))
			} else {
				// No checkpoint found before this message
				provider.log(`[Edit Message] No checkpoint found before message timestamp ${timestamp}.`)
				vscode.window.showErrorMessage(t("kilocode:userFeedback.no_checkpoint_found"))
			}
		}
		// Update the message text in the UI
		const updatedMessages = [...currentCline.clineMessages]
		updatedMessages[messageIndex] = {
			...updatedMessages[messageIndex],
			text: newText,
		}
		await currentCline.overwriteClineMessages(updatedMessages)

		// Regular edit without revert - use the resend sequence
		provider.log(`[Edit Message] Performing regular edit without revert for message at timestamp ${timestamp}.`)
		const success = await resendMessageSequence(
			provider,
			currentCline.taskId,
			messageIndex,
			timestamp,
			newText,
			images,
		)

		if (success) {
			vscode.window.showInformationMessage(t("kilocode:userFeedback.message_updated"))
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		provider.log(`[Edit Message] Error handling editMessage: ${errorMessage}`)
		vscode.window.showErrorMessage(t("kilocode:userFeedback.message_update_failed"))
	}
	return
}
