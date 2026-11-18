import { activeLocale, fmtCurrency, fmtNumber, fmtRelative, fmtTime, useAppApi, useAppEvents, useLanguageGeneration, useNavigate } from "@kirocrew/app-sdk";
import { Fragment, useEffect, useMemo, useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Btn, Card, EmptyState, ErrorNotice, PageHeader } from "@kirocrew/app-sdk/ui";
import { ArrowUpRight, Bot, CalendarDays, Inbox, MessageSquare, Radar } from "lucide-react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
// src/api.ts
var bound = null;
/** Called by the page root with `useAppApi()`. */
function bindAppApi(api) {
	bound = api;
}
function api() {
	if (!bound) throw new Error("crew-pulse: the host API is not bound yet");
	return bound;
}
/** One id per click on a decision, never derived from content, so the server
*  replays a retry of the same click and refuses a different later one. */
function mintResponseId() {
	const c = globalThis.crypto;
	if (c && typeof c.randomUUID === "function") return "r_" + c.randomUUID();
	return "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
var list = (value, key) => {
	if (Array.isArray(value)) return value;
	if (key && value && typeof value === "object" && Array.isArray(value[key])) return value[key];
	return [];
};
var reads = {
	slots: async () => list(await api().get("/api/chat/slots"), "slots"),
	questions: async () => list(await api().get("/api/ask-question/pending"), "pending"),
	approvals: async () => list(await api().get("/api/approvals")),
	subagents: async () => list(await api().get("/api/spawn"), "agents"),
	workflows: async () => list(await api().get("/api/workflows/runs"), "runs"),
	crons: async () => list(await api().get("/api/crons"), "jobs"),
	members: async () => list(await api().get("/api/members"), "members"),
	usage: () => api().get("/api/usage/kiro"),
	status: () => api().get("/api/status"),
	config: () => api().get("/api/config/kirocrew"),
	turns: async (slot, range) => list(await api().get(`/api/usage/turns?slot=${encodeURIComponent(slot)}&${range}`), "turns")
};
function approvalTarget(slot, approval, info) {
	if (approval) return {
		origin: "coordinator",
		id: approval.id,
		slot,
		instance: approval.instance ?? ""
	};
	if (info?.origin === "native" && info.request_mid) return {
		origin: "native",
		id: info.request_id,
		slot,
		mid: info.request_mid
	};
	if (info?.origin === "coordinator") return {
		origin: "coordinator",
		id: info.request_id,
		slot,
		instance: info.request_instance ?? ""
	};
	return null;
}
var writes = {
	decide: (target, action) => {
		const responseId = mintResponseId();
		if (target.origin === "coordinator") {
			const query = new URLSearchParams({
				origin: "coordinator",
				slot: target.slot,
				instance: target.instance
			});
			return api().post(`/api/approvals/${encodeURIComponent(target.id)}/${action}?${query}`, { response_id: responseId });
		}
		return api().post(`/api/chat/slots/${encodeURIComponent(target.slot)}/approve`, {
			action: action === "approve" ? "approved" : "rejected_once",
			origin: "native",
			request_id: target.id,
			request_mid: target.mid,
			response_id: responseId
		});
	},
	/** Answer a question card: the MCP `ask_question` wait receives `answers`. */
	answer: (askId, answers) => api().post(`/api/ask-question/${encodeURIComponent(askId)}/answer`, { answers }),
	/** Send a follow-up pick as an ordinary message to its session. */
	send: (slot, message) => api().post("/api/chat", {
		message,
		slot
	})
};
// src/i18n.ts
/**
* The app's own strings. A bundle cannot read the dashboard's catalogs (those
* belong to the host and change with it), so every locale the dashboard ships is
* bundled here and looked up against the host's active language.
*
* The catalogs (`ui/i18n/<locale>.json`) carry the strings this page needs under
* the key paths the dashboard's own catalogs use for the same words (so "Needs
* you" is `commandCenter.attention_filter` here as it is there), plus the app's
* own few under `pulse.*`.
*
* Lookup order: the exact locale (`pt`, `zh-CN`), then its base language, then
* English, then the key itself. A numeric `count` selects the plural form the
* locale's rules name (`_one`, `_few`, `_many`, `_other`), as the catalogs are
* keyed. `{{name}}` placeholders are filled from `vars`; one with no value is
* left as written.
*
* `t` reads the language at call time. The root component subscribes to the
* host's language changes (`useLanguageGeneration`), and its re-render reaches
* every child, so a language switch repaints the page without a reload.
*/
var CATALOGS = {
	bn: {
		commandCenter: {
			"approve": "শুধু এবার অনুমতি দাও",
			"attention_filter": "তোমার সাড়া প্রয়োজন",
			"blocked": "বাধাপ্রাপ্ত",
			"explicit_input": "তুমি স্পষ্টভাবে জমা দিলেই কেবল উত্তর বা অনুমোদন পাঠানো হয়।",
			"idle": "নিষ্ক্রিয়",
			"no_input": "এই বিভাগে তোমার অপেক্ষায় কিছু নেই।",
			"open_session": "সেশন খোলো",
			"options_question": "সেশনটি তোমার বেছে নেওয়ার অপেক্ষায় আছে।",
			"reject": "শুধু এবার প্রত্যাখ্যান করো",
			"reject_help": "শুধু এবার প্রত্যাখ্যান করলে এই অনুরোধ প্রত্যাখ্যাত হয়। অনুমতির মোড বদলায় না।",
			"running": "চলছে",
			"send_answer": "উত্তর পাঠাও",
			"session_label": "সেশন {{number}}",
			"stale": "কিছু উৎস অনুপলব্ধ। সর্বশেষ জানা অবস্থা পুরোনো হতে পারে।",
			"worker_label": "কর্মীর কাজ {{number}}",
			"workflow_label": "কর্মপ্রবাহ {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "এই অনুমোদনটির মেয়াদ শেষ হয়ে গেছে, ইতিমধ্যে সিদ্ধান্ত নেওয়া হয়েছে, অথবা একটি নতুন অনুরোধ এটির জায়গা নিয়েছে — এজেন্ট আর এটির জন্য অপেক্ষা করছে না।",
				"decision_failed": "এই সিদ্ধান্তটি হয়তো রেকর্ড করা হয়নি — অনুরোধটি ব্যর্থ হয়েছে।",
				"decision_not_recorded_error": "এই সিদ্ধান্তটি রেকর্ড করা হয়নি: {{error}}",
				"tool_approval_requested": "টুলের অনুমোদন চাওয়া হয়েছে:"
			},
			"questionCard": { "or_type_a_custom_answer": "অথবা একটি কাস্টম উত্তর লিখুন..." }
		},
		pulse: {
			"answer_failed": "উত্তর পাঠানো যায়নি।",
			"answer_in_session": "সেশনে উত্তর দিন",
			"approval_pending": "একটি টুল অনুমোদনের অপেক্ষায় আছে",
			"gateway_unreachable": "গেটওয়েতে পৌঁছানো যায়নি।",
			"sent": "পাঠানো হয়েছে",
			"sessions_unavailable": "সেশনগুলো লোড করা যায়নি।",
			"title": "Pulse",
			"wants_to_run": "{{tool}} চালাতে চায়"
		},
		nav: {
			"crew_members": "Bot",
			"schedule": "সময়সূচি"
		},
		pages: {
			"homePage": {
				"active_now": "এখন সক্রিয়",
				"approvals_count_one": "{{amount}}টি অনুমোদন",
				"approvals_count_other": "{{amount}}টি অনুমোদন",
				"bots_count": "{{total}}টির মধ্যে {{running}}টি কাজ করছে",
				"bots_unavailable": "Bot লোড করা যায়নি।",
				"due": "{{when}} নির্ধারিত",
				"failing_count_one": "{{amount}}টি ব্যর্থ",
				"failing_count_other": "{{amount}}টি ব্যর্থ",
				"fleet_all_resting": "সবকিছু বিশ্রামে আছে।",
				"fleet_resting_one": "{{amount}}টি বিশ্রামে",
				"fleet_resting_other": "{{amount}}টি বিশ্রামে",
				"fleet_title": "প্রতিটি এজেন্ট কী করছে",
				"kind_session": "সেশন",
				"kind_subagent": "সাব-এজেন্ট",
				"kind_workflow": "ওয়ার্কফ্লো",
				"last_active": "সর্বশেষ সক্রিয় {{when}}",
				"next_run": "পরবর্তী: {{name}} {{when}}",
				"no_next_run": "কোনো জব বাকি নেই",
				"now": "এখন",
				"open": "খোলো",
				"open_overview": "সেটিংস › ওভারভিউ",
				"open_page": "পেজ খোলো",
				"paused_count_one": "{{amount}}টি পজ করা",
				"paused_count_other": "{{amount}}টি পজ করা",
				"questions_count_one": "{{amount}}টি প্রশ্ন",
				"questions_count_other": "{{amount}}টি প্রশ্ন",
				"running_for": "{{duration}} ধরে চলছে",
				"schedule_unavailable": "সময়সূচি লোড করা যায়নি।",
				"scheduled": "সময়সূচিতে",
				"spend_bar_label": "আজকের মডেল অনুযায়ী ব্যবহার",
				"spend_none": "আজ কোনো ব্যবহার রেকর্ড হয়নি।",
				"spend_other": "অন্য মডেল",
				"spend_plan": "{{plan}} প্ল্যান: {{percent}} ব্যবহৃত",
				"spend_title": "খরচ হওয়া টোকেন",
				"state_done": "সম্পন্ন",
				"state_stopped": "থামানো",
				"state_waiting": "অপেক্ষমাণ",
				"subagents_one": "{{amount}}টি সাব-এজেন্ট",
				"subagents_other": "{{amount}}টি সাব-এজেন্ট",
				"subtitle": "তোমার ক্রু কী করছে, কী তোমার জন্য অপেক্ষা করছে, আর সামনে কী আসছে।",
				"suggestions_count_one": "{{amount}}টি পরামর্শ",
				"suggestions_count_other": "{{amount}}টি পরামর্শ",
				"today": "আজ",
				"track_label": "এই সময়ে {{name}}-এর কার্যকলাপ",
				"upcoming": "আসন্ন",
				"window_hours_one": "{{amount}} ঘ",
				"window_hours_other": "{{amount}} ঘ",
				"window_label": "সময়সীমা",
				"with_subagents": "সাব-এজেন্ট চলছে",
				"workflows_one": "{{amount}}টি ওয়ার্কফ্লো",
				"workflows_other": "{{amount}}টি ওয়ার্কফ্লো",
				"show_all_one": "সব দেখান (আরও {{amount}})",
				"show_all_other": "সব দেখান (আরও {{amount}})"
			},
			"membersPage": { "empty_title": "এখনও কোনো Bot নেই" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "{{provider}}-এর জন্য ব্যবহার ট্র্যাকিং উপলব্ধ নয়।" } },
			"overviewPage": {
				"all_systems_running": "সব সিস্টেম চলছে",
				"connecting": "কানেক্ট হচ্ছে…",
				"reconnecting": "আবার কানেক্ট হচ্ছে…",
				"today_line": "আজ: {{summary}}",
				"today_messages_one": "{{amount}}টি বার্তা",
				"today_messages_other": "{{amount}}টি বার্তা",
				"today_sessions_one": "{{amount}}টি সেশন",
				"today_sessions_other": "{{amount}}টি সেশন",
				"today_tokens_one": "{{amount}}টি টোকেন",
				"today_tokens_other": "{{amount}}টি টোকেন",
				"uptime_line": "{{uptime}} ধরে চালু",
				"uptime_line_version": "{{uptime}} ধরে চালু · v{{version}}"
			},
			"schedulePage": {
				"error": "ত্রুটি",
				"running": "চলছে"
			},
			"sessionsPage": { "empty_title": "কোনো সেশন নেই" }
		}
	},
	de: {
		commandCenter: {
			"approve": "Einmal genehmigen",
			"attention_filter": "Du bist gefragt",
			"blocked": "Blockiert",
			"explicit_input": "Erst dein ausdrückliches Absenden übermittelt eine Antwort oder Genehmigung.",
			"idle": "Inaktiv",
			"no_input": "In dieser Kategorie wartet nichts auf dich.",
			"open_session": "Sitzung öffnen",
			"options_question": "Die Sitzung wartet auf deine Auswahl.",
			"reject": "Einmal ablehnen",
			"reject_help": "Einmal ablehnen verweigert diese Anfrage. Der Berechtigungsmodus bleibt gleich.",
			"running": "Läuft",
			"send_answer": "Antwort senden",
			"session_label": "Sitzung {{number}}",
			"stale": "Einige Quellen sind nicht verfügbar. Der letzte bekannte Stand kann veraltet sein.",
			"worker_label": "Arbeitsauftrag {{number}}",
			"workflow_label": "Workflow {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "Diese Genehmigung ist abgelaufen, wurde bereits entschieden oder durch eine neuere Anfrage ersetzt — der Agent wartet nicht mehr darauf.",
				"decision_failed": "Diese Entscheidung wurde möglicherweise nicht gespeichert — die Anfrage ist fehlgeschlagen.",
				"decision_not_recorded_error": "Diese Entscheidung wurde nicht gespeichert: {{error}}",
				"tool_approval_requested": "Werkzeuggenehmigung angefordert:"
			},
			"questionCard": { "or_type_a_custom_answer": "Oder geben Sie eine eigene Antwort ein…" }
		},
		pulse: {
			"answer_failed": "Die Antwort konnte nicht gesendet werden.",
			"answer_in_session": "In der Sitzung antworten",
			"approval_pending": "Ein Werkzeug wartet auf Freigabe",
			"gateway_unreachable": "Das Gateway war nicht erreichbar.",
			"sent": "Gesendet",
			"sessions_unavailable": "Die Sitzungen konnten nicht geladen werden.",
			"title": "Pulse",
			"wants_to_run": "{{tool}} möchte ausgeführt werden"
		},
		nav: {
			"crew_members": "Bots",
			"schedule": "Zeitplan"
		},
		pages: {
			"homePage": {
				"active_now": "Gerade aktiv",
				"approvals_count_one": "{{amount}} Freigabe",
				"approvals_count_other": "{{amount}} Freigaben",
				"bots_count": "{{running}} von {{total}} arbeiten",
				"bots_unavailable": "Die Bot konnten nicht geladen werden.",
				"due": "Fällig {{when}}",
				"failing_count_one": "{{amount}} fehlgeschlagen",
				"failing_count_other": "{{amount}} fehlgeschlagen",
				"fleet_all_resting": "Alles ruht.",
				"fleet_resting_one": "{{amount}} ruht",
				"fleet_resting_other": "{{amount}} ruhen",
				"fleet_title": "Was jeder Agent gerade tut",
				"kind_session": "Sitzung",
				"kind_subagent": "Subagent",
				"kind_workflow": "Workflow",
				"last_active": "Zuletzt aktiv {{when}}",
				"next_run": "Nächster: {{name}} {{when}}",
				"no_next_run": "Kein Job steht an",
				"now": "Jetzt",
				"open": "Öffnen",
				"open_overview": "Einstellungen › Übersicht",
				"open_page": "Seite öffnen",
				"paused_count_one": "{{amount}} pausiert",
				"paused_count_other": "{{amount}} pausiert",
				"questions_count_one": "{{amount}} Frage",
				"questions_count_other": "{{amount}} Fragen",
				"running_for": "läuft seit {{duration}}",
				"schedule_unavailable": "Der Zeitplan konnte nicht geladen werden.",
				"scheduled": "Geplant",
				"spend_bar_label": "Heutige Nutzung nach Modell",
				"spend_none": "Heute wurde keine Nutzung erfasst.",
				"spend_other": "Andere Modelle",
				"spend_plan": "{{plan}}-Tarif: {{percent}} verbraucht",
				"spend_title": "Verbrauchte Tokens",
				"state_done": "Fertig",
				"state_stopped": "Gestoppt",
				"state_waiting": "Wartet",
				"subagents_one": "{{amount}} Subagent",
				"subagents_other": "{{amount}} Subagenten",
				"subtitle": "Was deine Crew gerade tut, was auf dich wartet und was als Nächstes ansteht.",
				"suggestions_count_one": "{{amount}} Vorschlag",
				"suggestions_count_other": "{{amount}} Vorschläge",
				"today": "Heute",
				"track_label": "Aktivität von {{name}} in diesem Zeitraum",
				"upcoming": "Demnächst",
				"window_hours_one": "{{amount}} h",
				"window_hours_other": "{{amount}} h",
				"window_label": "Zeitraum",
				"with_subagents": "Subagenten laufen",
				"workflows_one": "{{amount}} Workflow",
				"workflows_other": "{{amount}} Workflows",
				"show_all_one": "Alle anzeigen ({{amount}} weitere)",
				"show_all_other": "Alle anzeigen ({{amount}} weitere)"
			},
			"membersPage": { "empty_title": "Noch keine Bots" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "Nutzungserfassung ist für {{provider}} nicht verfügbar." } },
			"overviewPage": {
				"all_systems_running": "Alle Systeme laufen",
				"connecting": "Verbinden…",
				"reconnecting": "Neu verbinden…",
				"today_line": "Heute: {{summary}}",
				"today_messages_one": "{{amount}} Nachricht",
				"today_messages_other": "{{amount}} Nachrichten",
				"today_sessions_one": "{{amount}} Sitzung",
				"today_sessions_other": "{{amount}} Sitzungen",
				"today_tokens_one": "{{amount}} Token",
				"today_tokens_other": "{{amount}} Tokens",
				"uptime_line": "Läuft seit {{uptime}}",
				"uptime_line_version": "Läuft seit {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "Fehler",
				"running": "Läuft"
			},
			"sessionsPage": { "empty_title": "Keine Sitzungen" }
		}
	},
	en: {
		commandCenter: {
			"approve": "Approve once",
			"attention_filter": "Needs you",
			"blocked": "Blocked",
			"explicit_input": "Only your explicit submission sends an answer or approval.",
			"idle": "Idle",
			"no_input": "Nothing in this category is waiting for you.",
			"open_session": "Open session",
			"options_question": "The session is waiting for your choice.",
			"reject": "Reject once",
			"reject_help": "Reject once refuses this request. Permission mode stays the same.",
			"running": "Running",
			"send_answer": "Send answer",
			"session_label": "Session {{number}}",
			"stale": "Some sources are unavailable. The last known state may be out of date.",
			"worker_label": "Worker task {{number}}",
			"workflow_label": "Workflow {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "This approval expired, was already decided, or was replaced by a newer request — the agent is no longer waiting on it.",
				"decision_failed": "This decision may not have been recorded — the request failed.",
				"decision_not_recorded_error": "This decision wasn't recorded: {{error}}",
				"tool_approval_requested": "Tool approval requested:"
			},
			"questionCard": { "or_type_a_custom_answer": "Or type a custom answer..." }
		},
		pulse: {
			"answer_failed": "The answer could not be sent.",
			"answer_in_session": "Answer in the session",
			"approval_pending": "A tool is waiting for approval",
			"gateway_unreachable": "The gateway could not be reached.",
			"sent": "Sent",
			"sessions_unavailable": "The sessions could not be loaded.",
			"title": "Pulse",
			"wants_to_run": "{{tool}} wants to run"
		},
		nav: {
			"crew_members": "Bots",
			"schedule": "Schedule"
		},
		pages: {
			"homePage": {
				"active_now": "Active now",
				"approvals_count_one": "{{amount}} approval",
				"approvals_count_other": "{{amount}} approvals",
				"bots_count": "{{running}} of {{total}} working",
				"bots_unavailable": "The bots could not be loaded.",
				"due": "Due {{when}}",
				"failing_count_one": "{{amount}} failing",
				"failing_count_other": "{{amount}} failing",
				"fleet_all_resting": "Everything is at rest.",
				"fleet_resting_one": "{{amount}} at rest",
				"fleet_resting_other": "{{amount}} at rest",
				"fleet_title": "What each agent is doing",
				"kind_session": "Session",
				"kind_subagent": "Subagent",
				"kind_workflow": "Workflow",
				"last_active": "Last active {{when}}",
				"next_run": "Next: {{name}} {{when}}",
				"no_next_run": "No job is due",
				"now": "Now",
				"open": "Open",
				"open_overview": "Settings › Overview",
				"open_page": "Open page",
				"paused_count_one": "{{amount}} paused",
				"paused_count_other": "{{amount}} paused",
				"questions_count_one": "{{amount}} question",
				"questions_count_other": "{{amount}} questions",
				"running_for": "running {{duration}}",
				"schedule_unavailable": "The schedule could not be loaded.",
				"scheduled": "Scheduled",
				"spend_bar_label": "Today's usage by model",
				"spend_none": "No usage recorded today.",
				"spend_other": "Other models",
				"spend_plan": "{{plan}} plan: {{percent}} used",
				"spend_title": "Tokens spent",
				"state_done": "Done",
				"state_stopped": "Stopped",
				"state_waiting": "Waiting",
				"subagents_one": "{{amount}} subagent",
				"subagents_other": "{{amount}} subagents",
				"subtitle": "What your crew is doing, what is waiting on you, and what is coming up.",
				"suggestions_count_one": "{{amount}} suggestion",
				"suggestions_count_other": "{{amount}} suggestions",
				"today": "Today",
				"track_label": "Activity of {{name}} in this window",
				"upcoming": "Upcoming",
				"window_hours_one": "{{amount}}h",
				"window_hours_other": "{{amount}}h",
				"window_label": "Time window",
				"with_subagents": "Subagents running",
				"workflows_one": "{{amount}} workflow",
				"workflows_other": "{{amount}} workflows",
				"show_all_one": "Show all ({{amount}} more)",
				"show_all_other": "Show all ({{amount}} more)"
			},
			"membersPage": { "empty_title": "No bots yet" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "Usage tracking is not available for {{provider}}." } },
			"overviewPage": {
				"all_systems_running": "All systems running",
				"connecting": "Connecting…",
				"reconnecting": "Reconnecting…",
				"today_line": "Today: {{summary}}",
				"today_messages_one": "{{amount}} message",
				"today_messages_other": "{{amount}} messages",
				"today_sessions_one": "{{amount}} session",
				"today_sessions_other": "{{amount}} sessions",
				"today_tokens_one": "{{amount}} token",
				"today_tokens_other": "{{amount}} tokens",
				"uptime_line": "Up {{uptime}}",
				"uptime_line_version": "Up {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "Error",
				"running": "Running"
			},
			"sessionsPage": { "empty_title": "No sessions" }
		}
	},
	es: {
		commandCenter: {
			"approve": "Aprobar una vez",
			"attention_filter": "Requiere tu atención",
			"blocked": "Bloqueado",
			"explicit_input": "Solo tu envío explícito transmite una respuesta o aprobación.",
			"idle": "Inactivo",
			"no_input": "No hay nada en esta categoría que requiera tu atención.",
			"open_session": "Abrir sesión",
			"options_question": "La sesión espera tu elección.",
			"reject": "Rechazar una vez",
			"reject_help": "Rechazar una vez deniega esta solicitud. El modo de permisos no cambia.",
			"running": "En ejecución",
			"send_answer": "Enviar respuesta",
			"session_label": "Sesión {{number}}",
			"stale": "Algunas fuentes no están disponibles. El último estado conocido puede estar desactualizado.",
			"worker_label": "Tarea del agente {{number}}",
			"workflow_label": "Flujo de trabajo {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "Esta aprobación expiró, ya fue decidida o una solicitud más reciente la reemplazó — el agente ya no la está esperando.",
				"decision_failed": "Es posible que esta decisión no se haya registrado — la solicitud falló.",
				"decision_not_recorded_error": "Esta decisión no se registró: {{error}}",
				"tool_approval_requested": "Aprobación de herramienta solicitada:"
			},
			"questionCard": { "or_type_a_custom_answer": "O escribe una respuesta personalizada..." }
		},
		pulse: {
			"answer_failed": "No se pudo enviar la respuesta.",
			"answer_in_session": "Responder en la sesión",
			"approval_pending": "Una herramienta espera aprobación",
			"gateway_unreachable": "No se pudo contactar con el gateway.",
			"sent": "Enviado",
			"sessions_unavailable": "No se pudieron cargar las sesiones.",
			"title": "Pulse",
			"wants_to_run": "{{tool}} quiere ejecutarse"
		},
		nav: {
			"crew_members": "Bots",
			"schedule": "Programación"
		},
		pages: {
			"homePage": {
				"active_now": "Activo ahora",
				"approvals_count_many": "{{amount}} aprobaciones",
				"approvals_count_one": "{{amount}} aprobación",
				"approvals_count_other": "{{amount}} aprobaciones",
				"bots_count": "{{running}} de {{total}} trabajando",
				"bots_unavailable": "No se pudieron cargar los Bot.",
				"due": "Programado {{when}}",
				"failing_count_many": "{{amount}} con error",
				"failing_count_one": "{{amount}} con error",
				"failing_count_other": "{{amount}} con error",
				"fleet_all_resting": "Todo está en reposo.",
				"fleet_resting_many": "{{amount}} en reposo",
				"fleet_resting_one": "{{amount}} en reposo",
				"fleet_resting_other": "{{amount}} en reposo",
				"fleet_title": "Qué está haciendo cada agente",
				"kind_session": "Sesión",
				"kind_subagent": "Subagente",
				"kind_workflow": "Flujo de trabajo",
				"last_active": "Última actividad {{when}}",
				"next_run": "Siguiente: {{name}} {{when}}",
				"no_next_run": "Ninguna tarea pendiente",
				"now": "Ahora",
				"open": "Abrir",
				"open_overview": "Ajustes › Resumen",
				"open_page": "Abrir página",
				"paused_count_many": "{{amount}} pausados",
				"paused_count_one": "{{amount}} pausado",
				"paused_count_other": "{{amount}} pausados",
				"questions_count_many": "{{amount}} preguntas",
				"questions_count_one": "{{amount}} pregunta",
				"questions_count_other": "{{amount}} preguntas",
				"running_for": "en ejecución {{duration}}",
				"schedule_unavailable": "No se pudo cargar la programación.",
				"scheduled": "Programados",
				"spend_bar_label": "Uso de hoy por modelo",
				"spend_none": "Hoy no se ha registrado uso.",
				"spend_other": "Otros modelos",
				"spend_plan": "Plan {{plan}}: {{percent}} usado",
				"spend_title": "Tokens consumidos",
				"state_done": "Terminado",
				"state_stopped": "Detenido",
				"state_waiting": "En espera",
				"subagents_many": "{{amount}} subagentes",
				"subagents_one": "{{amount}} subagente",
				"subagents_other": "{{amount}} subagentes",
				"subtitle": "Qué hace tu equipo, qué espera tu respuesta y qué viene a continuación.",
				"suggestions_count_many": "{{amount}} sugerencias",
				"suggestions_count_one": "{{amount}} sugerencia",
				"suggestions_count_other": "{{amount}} sugerencias",
				"today": "Hoy",
				"track_label": "Actividad de {{name}} en este periodo",
				"upcoming": "Próximos",
				"window_hours_many": "{{amount}} h",
				"window_hours_one": "{{amount}} h",
				"window_hours_other": "{{amount}} h",
				"window_label": "Periodo",
				"with_subagents": "Subagentes en ejecución",
				"workflows_many": "{{amount}} flujos de trabajo",
				"workflows_one": "{{amount}} flujo de trabajo",
				"workflows_other": "{{amount}} flujos de trabajo",
				"show_all_many": "Mostrar todo ({{amount}} más)",
				"show_all_one": "Mostrar todo ({{amount}} más)",
				"show_all_other": "Mostrar todo ({{amount}} más)"
			},
			"membersPage": { "empty_title": "Aún no hay Bots" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "El seguimiento de uso no está disponible para {{provider}}." } },
			"overviewPage": {
				"all_systems_running": "Todos los sistemas en ejecución",
				"connecting": "Conectando…",
				"reconnecting": "Reconectando…",
				"today_line": "Hoy: {{summary}}",
				"today_messages_many": "{{amount}} mensajes",
				"today_messages_one": "{{amount}} mensaje",
				"today_messages_other": "{{amount}} mensajes",
				"today_sessions_many": "{{amount}} sesiones",
				"today_sessions_one": "{{amount}} sesión",
				"today_sessions_other": "{{amount}} sesiones",
				"today_tokens_many": "{{amount}} tokens",
				"today_tokens_one": "{{amount}} token",
				"today_tokens_other": "{{amount}} tokens",
				"uptime_line": "Activo desde hace {{uptime}}",
				"uptime_line_version": "Activo desde hace {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "Error",
				"running": "En ejecución"
			},
			"sessionsPage": { "empty_title": "No hay sesiones" }
		}
	},
	fr: {
		commandCenter: {
			"approve": "Approuver une fois",
			"attention_filter": "Ton intervention",
			"blocked": "Bloqué",
			"explicit_input": "Seule ta validation explicite envoie une réponse ou une approbation.",
			"idle": "Inactif",
			"no_input": "Rien dans cette catégorie ne demande ton attention.",
			"open_session": "Ouvrir la session",
			"options_question": "La session attend ton choix.",
			"reject": "Refuser une fois",
			"reject_help": "Refuser une fois refuse cette demande. Le mode d’autorisation reste le même.",
			"running": "En cours",
			"send_answer": "Envoyer la réponse",
			"session_label": "Session {{number}}",
			"stale": "Certaines sources sont indisponibles. Le dernier état connu peut être obsolète.",
			"worker_label": "Tâche de l’agent {{number}}",
			"workflow_label": "Flux de travail {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "Cette approbation a expiré, a déjà été décidée ou a été remplacée par une demande plus récente — l’agent ne l’attend plus.",
				"decision_failed": "Cette décision n’a peut-être pas été enregistrée — la requête a échoué.",
				"decision_not_recorded_error": "Cette décision n’a pas été enregistrée : {{error}}",
				"tool_approval_requested": "Approbation d’outil demandée :"
			},
			"questionCard": { "or_type_a_custom_answer": "Ou saisissez une réponse personnalisée..." }
		},
		pulse: {
			"answer_failed": "La réponse n’a pas pu être envoyée.",
			"answer_in_session": "Répondre dans la session",
			"approval_pending": "Un outil attend une approbation",
			"gateway_unreachable": "Le gateway n’a pas pu être joint.",
			"sent": "Envoyé",
			"sessions_unavailable": "Les sessions n’ont pas pu être chargées.",
			"title": "Pulse",
			"wants_to_run": "{{tool}} veut s’exécuter"
		},
		nav: {
			"crew_members": "Bots",
			"schedule": "Planification"
		},
		pages: {
			"homePage": {
				"active_now": "En cours",
				"approvals_count_many": "{{amount}} approbations",
				"approvals_count_one": "{{amount}} approbation",
				"approvals_count_other": "{{amount}} approbations",
				"bots_count": "{{running}} sur {{total}} au travail",
				"bots_unavailable": "Les Bot n’ont pas pu être chargés.",
				"due": "Prévu {{when}}",
				"failing_count_many": "{{amount}} en erreur",
				"failing_count_one": "{{amount}} en erreur",
				"failing_count_other": "{{amount}} en erreur",
				"fleet_all_resting": "Tout est au repos.",
				"fleet_resting_many": "{{amount}} au repos",
				"fleet_resting_one": "{{amount}} au repos",
				"fleet_resting_other": "{{amount}} au repos",
				"fleet_title": "Ce que fait chaque agent",
				"kind_session": "Session",
				"kind_subagent": "Sous-agent",
				"kind_workflow": "Workflow",
				"last_active": "Dernière activité {{when}}",
				"next_run": "Prochain : {{name}} {{when}}",
				"no_next_run": "Aucune tâche à venir",
				"now": "Maintenant",
				"open": "Ouvrir",
				"open_overview": "Paramètres › Aperçu",
				"open_page": "Ouvrir la page",
				"paused_count_many": "{{amount}} en pause",
				"paused_count_one": "{{amount}} en pause",
				"paused_count_other": "{{amount}} en pause",
				"questions_count_many": "{{amount}} questions",
				"questions_count_one": "{{amount}} question",
				"questions_count_other": "{{amount}} questions",
				"running_for": "en cours depuis {{duration}}",
				"schedule_unavailable": "La planification n’a pas pu être chargée.",
				"scheduled": "Planifiés",
				"spend_bar_label": "Utilisation du jour par modèle",
				"spend_none": "Aucune utilisation enregistrée aujourd’hui.",
				"spend_other": "Autres modèles",
				"spend_plan": "Forfait {{plan}} : {{percent}} utilisé",
				"spend_title": "Tokens consommés",
				"state_done": "Terminé",
				"state_stopped": "Arrêté",
				"state_waiting": "En attente",
				"subagents_many": "{{amount}} sous-agents",
				"subagents_one": "{{amount}} sous-agent",
				"subagents_other": "{{amount}} sous-agents",
				"subtitle": "Ce que fait ton équipe, ce qui attend ta réponse et ce qui arrive ensuite.",
				"suggestions_count_many": "{{amount}} suggestions",
				"suggestions_count_one": "{{amount}} suggestion",
				"suggestions_count_other": "{{amount}} suggestions",
				"today": "Aujourd’hui",
				"track_label": "Activité de {{name}} sur cette période",
				"upcoming": "À venir",
				"window_hours_many": "{{amount}} h",
				"window_hours_one": "{{amount}} h",
				"window_hours_other": "{{amount}} h",
				"window_label": "Période",
				"with_subagents": "Sous-agents en cours",
				"workflows_many": "{{amount}} workflows",
				"workflows_one": "{{amount}} workflow",
				"workflows_other": "{{amount}} workflows",
				"show_all_many": "Tout afficher ({{amount}} de plus)",
				"show_all_one": "Tout afficher ({{amount}} de plus)",
				"show_all_other": "Tout afficher ({{amount}} de plus)"
			},
			"membersPage": { "empty_title": "Aucun Bot pour l'instant" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "Le suivi de l’utilisation n’est pas disponible pour {{provider}}." } },
			"overviewPage": {
				"all_systems_running": "Tous les systèmes fonctionnent",
				"connecting": "Connexion…",
				"reconnecting": "Reconnexion…",
				"today_line": "Aujourd’hui : {{summary}}",
				"today_messages_many": "{{amount}} messages",
				"today_messages_one": "{{amount}} message",
				"today_messages_other": "{{amount}} messages",
				"today_sessions_many": "{{amount}} sessions",
				"today_sessions_one": "{{amount}} session",
				"today_sessions_other": "{{amount}} sessions",
				"today_tokens_many": "{{amount}} tokens",
				"today_tokens_one": "{{amount}} token",
				"today_tokens_other": "{{amount}} tokens",
				"uptime_line": "Actif depuis {{uptime}}",
				"uptime_line_version": "Actif depuis {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "Erreur",
				"running": "En cours"
			},
			"sessionsPage": { "empty_title": "Aucune session" }
		}
	},
	hi: {
		commandCenter: {
			"approve": "इस बार अनुमति दो",
			"attention_filter": "तुम्हारी ज़रूरत है",
			"blocked": "अवरुद्ध",
			"explicit_input": "केवल तुम्हारे स्पष्ट रूप से सबमिट करने पर उत्तर या अनुमोदन भेजा जाता है।",
			"idle": "निष्क्रिय",
			"no_input": "इस श्रेणी में तुम्हारी प्रतीक्षा में कुछ नहीं है।",
			"open_session": "सत्र खोलो",
			"options_question": "सत्र तुम्हारे चुनाव की प्रतीक्षा कर रहा है।",
			"reject": "इस बार अस्वीकार करो",
			"reject_help": "इस बार अस्वीकार करने से यह अनुरोध अस्वीकार होता है। अनुमति मोड नहीं बदलता।",
			"running": "चल रहा है",
			"send_answer": "उत्तर भेजो",
			"session_label": "सत्र {{number}}",
			"stale": "कुछ स्रोत उपलब्ध नहीं हैं। अंतिम ज्ञात स्थिति पुरानी हो सकती है।",
			"worker_label": "कार्यकर्ता का कार्य {{number}}",
			"workflow_label": "कार्यप्रवाह {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "यह स्वीकृति समाप्त हो गई है, पहले ही तय हो चुकी है, या किसी नए अनुरोध ने इसकी जगह ले ली है — एजेंट अब इसकी प्रतीक्षा नहीं कर रहा है।",
				"decision_failed": "यह निर्णय शायद दर्ज नहीं हुआ — अनुरोध विफल रहा।",
				"decision_not_recorded_error": "यह निर्णय दर्ज नहीं हुआ: {{error}}",
				"tool_approval_requested": "टूल स्वीकृति का अनुरोध:"
			},
			"questionCard": { "or_type_a_custom_answer": "या कस्टम उत्तर लिखें..." }
		},
		pulse: {
			"answer_failed": "जवाब नहीं भेजा जा सका।",
			"answer_in_session": "सत्र में जवाब दें",
			"approval_pending": "एक टूल अनुमति की प्रतीक्षा में है",
			"gateway_unreachable": "गेटवे से संपर्क नहीं हो सका।",
			"sent": "भेजा गया",
			"sessions_unavailable": "सत्र लोड नहीं हो सके।",
			"title": "Pulse",
			"wants_to_run": "{{tool}} चलाने की अनुमति चाहता है"
		},
		nav: {
			"crew_members": "Bot",
			"schedule": "शेड्यूल"
		},
		pages: {
			"homePage": {
				"active_now": "अभी सक्रिय",
				"approvals_count_one": "{{amount}} अनुमोदन",
				"approvals_count_other": "{{amount}} अनुमोदन",
				"bots_count": "{{total}} में से {{running}} काम कर रहे हैं",
				"bots_unavailable": "Bot लोड नहीं हो सके।",
				"due": "{{when}} देय",
				"failing_count_one": "{{amount}} विफल",
				"failing_count_other": "{{amount}} विफल",
				"fleet_all_resting": "सब कुछ निष्क्रिय है।",
				"fleet_resting_one": "{{amount}} निष्क्रिय",
				"fleet_resting_other": "{{amount}} निष्क्रिय",
				"fleet_title": "हर एजेंट क्या कर रहा है",
				"kind_session": "सत्र",
				"kind_subagent": "सब-एजेंट",
				"kind_workflow": "वर्कफ़्लो",
				"last_active": "आख़िरी गतिविधि {{when}}",
				"next_run": "अगला: {{name}} {{when}}",
				"no_next_run": "कोई जॉब बाकी नहीं है",
				"now": "अभी",
				"open": "खोलें",
				"open_overview": "सेटिंग्स › ओवरव्यू",
				"open_page": "पेज खोलें",
				"paused_count_one": "{{amount}} रोका गया",
				"paused_count_other": "{{amount}} रोके गए",
				"questions_count_one": "{{amount}} प्रश्न",
				"questions_count_other": "{{amount}} प्रश्न",
				"running_for": "{{duration}} से चल रहा",
				"schedule_unavailable": "शेड्यूल लोड नहीं हो सका।",
				"scheduled": "शेड्यूल किए गए",
				"spend_bar_label": "आज मॉडल के अनुसार उपयोग",
				"spend_none": "आज कोई उपयोग दर्ज नहीं हुआ।",
				"spend_other": "अन्य मॉडल",
				"spend_plan": "{{plan}} प्लान: {{percent}} उपयोग हुआ",
				"spend_title": "खर्च हुए टोकन",
				"state_done": "पूर्ण",
				"state_stopped": "रोका गया",
				"state_waiting": "प्रतीक्षा में",
				"subagents_one": "{{amount}} सब-एजेंट",
				"subagents_other": "{{amount}} सब-एजेंट",
				"subtitle": "तुम्हारा क्रू क्या कर रहा है, क्या तुम्हारा इंतज़ार कर रहा है, और आगे क्या होने वाला है।",
				"suggestions_count_one": "{{amount}} सुझाव",
				"suggestions_count_other": "{{amount}} सुझाव",
				"today": "आज",
				"track_label": "इस अवधि में {{name}} की गतिविधि",
				"upcoming": "आगामी",
				"window_hours_one": "{{amount}} घं",
				"window_hours_other": "{{amount}} घं",
				"window_label": "समय अवधि",
				"with_subagents": "सब-एजेंट चल रहे हैं",
				"workflows_one": "{{amount}} वर्कफ़्लो",
				"workflows_other": "{{amount}} वर्कफ़्लो",
				"show_all_one": "सभी दिखाएँ ({{amount}} और)",
				"show_all_other": "सभी दिखाएँ ({{amount}} और)"
			},
			"membersPage": { "empty_title": "अभी कोई Bot नहीं" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "{{provider}} के लिए उपयोग ट्रैकिंग उपलब्ध नहीं है।" } },
			"overviewPage": {
				"all_systems_running": "सभी सिस्टम चल रहे हैं",
				"connecting": "कनेक्ट हो रहा है…",
				"reconnecting": "फिर कनेक्ट हो रहा है…",
				"today_line": "आज: {{summary}}",
				"today_messages_one": "{{amount}} संदेश",
				"today_messages_other": "{{amount}} संदेश",
				"today_sessions_one": "{{amount}} सत्र",
				"today_sessions_other": "{{amount}} सत्र",
				"today_tokens_one": "{{amount}} टोकन",
				"today_tokens_other": "{{amount}} टोकन",
				"uptime_line": "चालू: {{uptime}}",
				"uptime_line_version": "चालू: {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "त्रुटि",
				"running": "चल रहा है"
			},
			"sessionsPage": { "empty_title": "कोई सत्र नहीं" }
		}
	},
	it: {
		commandCenter: {
			"approve": "Approva una volta",
			"attention_filter": "Serve il tuo intervento",
			"blocked": "Bloccato",
			"explicit_input": "Solo il tuo invio esplicito trasmette una risposta o un’approvazione.",
			"idle": "Inattivo",
			"no_input": "Niente in questa categoria richiede il tuo intervento.",
			"open_session": "Apri sessione",
			"options_question": "La sessione attende la tua scelta.",
			"reject": "Rifiuta una volta",
			"reject_help": "Rifiuta una volta nega questa richiesta. La modalità di autorizzazione resta la stessa.",
			"running": "In esecuzione",
			"send_answer": "Invia risposta",
			"session_label": "Sessione {{number}}",
			"stale": "Alcune fonti non sono disponibili. L’ultimo stato noto potrebbe non essere aggiornato.",
			"worker_label": "Attività dell’agente {{number}}",
			"workflow_label": "Flusso di lavoro {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "Questa approvazione è scaduta, è già stata decisa o è stata sostituita da una richiesta più recente — l’agente non la sta più aspettando.",
				"decision_failed": "Questa decisione potrebbe non essere stata registrata — la richiesta non è riuscita.",
				"decision_not_recorded_error": "Questa decisione non è stata registrata: {{error}}",
				"tool_approval_requested": "Approvazione dello strumento richiesta:"
			},
			"questionCard": { "or_type_a_custom_answer": "Oppure digita una risposta personalizzata..." }
		},
		pulse: {
			"answer_failed": "La risposta non è stata inviata.",
			"answer_in_session": "Rispondi nella sessione",
			"approval_pending": "Uno strumento attende l’approvazione",
			"gateway_unreachable": "Il gateway non è raggiungibile.",
			"sent": "Inviato",
			"sessions_unavailable": "Le sessioni non sono state caricate.",
			"title": "Pulse",
			"wants_to_run": "{{tool}} vuole essere eseguito"
		},
		nav: {
			"crew_members": "Bot",
			"schedule": "Pianificazione"
		},
		pages: {
			"homePage": {
				"active_now": "Attivi ora",
				"approvals_count_many": "{{amount}} approvazioni",
				"approvals_count_one": "{{amount}} approvazione",
				"approvals_count_other": "{{amount}} approvazioni",
				"bots_count": "{{running}} di {{total}} al lavoro",
				"bots_unavailable": "Impossibile caricare i Bot.",
				"due": "Previsto {{when}}",
				"failing_count_many": "{{amount}} in errore",
				"failing_count_one": "{{amount}} in errore",
				"failing_count_other": "{{amount}} in errore",
				"fleet_all_resting": "Tutto è a riposo.",
				"fleet_resting_many": "{{amount}} a riposo",
				"fleet_resting_one": "{{amount}} a riposo",
				"fleet_resting_other": "{{amount}} a riposo",
				"fleet_title": "Cosa sta facendo ogni agente",
				"kind_session": "Sessione",
				"kind_subagent": "Sottoagente",
				"kind_workflow": "Workflow",
				"last_active": "Ultima attività {{when}}",
				"next_run": "Prossimo: {{name}} {{when}}",
				"no_next_run": "Nessun job in attesa",
				"now": "Adesso",
				"open": "Apri",
				"open_overview": "Impostazioni › Panoramica",
				"open_page": "Apri pagina",
				"paused_count_many": "{{amount}} in pausa",
				"paused_count_one": "{{amount}} in pausa",
				"paused_count_other": "{{amount}} in pausa",
				"questions_count_many": "{{amount}} domande",
				"questions_count_one": "{{amount}} domanda",
				"questions_count_other": "{{amount}} domande",
				"running_for": "in esecuzione da {{duration}}",
				"schedule_unavailable": "Impossibile caricare la pianificazione.",
				"scheduled": "Pianificati",
				"spend_bar_label": "Utilizzo di oggi per modello",
				"spend_none": "Nessun utilizzo registrato oggi.",
				"spend_other": "Altri modelli",
				"spend_plan": "Piano {{plan}}: {{percent}} utilizzato",
				"spend_title": "Token consumati",
				"state_done": "Completato",
				"state_stopped": "Fermato",
				"state_waiting": "In attesa",
				"subagents_many": "{{amount}} sottoagenti",
				"subagents_one": "{{amount}} sottoagente",
				"subagents_other": "{{amount}} sottoagenti",
				"subtitle": "Cosa sta facendo il tuo team, cosa aspetta una tua risposta e cosa arriva dopo.",
				"suggestions_count_many": "{{amount}} suggerimenti",
				"suggestions_count_one": "{{amount}} suggerimento",
				"suggestions_count_other": "{{amount}} suggerimenti",
				"today": "Oggi",
				"track_label": "Attività di {{name}} in questo periodo",
				"upcoming": "In arrivo",
				"window_hours_many": "{{amount}} h",
				"window_hours_one": "{{amount}} h",
				"window_hours_other": "{{amount}} h",
				"window_label": "Periodo",
				"with_subagents": "Sottoagenti in esecuzione",
				"workflows_many": "{{amount}} workflow",
				"workflows_one": "{{amount}} workflow",
				"workflows_other": "{{amount}} workflow",
				"show_all_many": "Mostra tutto ({{amount}} in più)",
				"show_all_one": "Mostra tutto ({{amount}} in più)",
				"show_all_other": "Mostra tutto ({{amount}} in più)"
			},
			"membersPage": { "empty_title": "Ancora nessun Bot" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "Il monitoraggio dell’utilizzo non è disponibile per {{provider}}." } },
			"overviewPage": {
				"all_systems_running": "Tutti i sistemi in funzione",
				"connecting": "Connessione…",
				"reconnecting": "Riconnessione…",
				"today_line": "Oggi: {{summary}}",
				"today_messages_many": "{{amount}} messaggi",
				"today_messages_one": "{{amount}} messaggio",
				"today_messages_other": "{{amount}} messaggi",
				"today_sessions_many": "{{amount}} sessioni",
				"today_sessions_one": "{{amount}} sessione",
				"today_sessions_other": "{{amount}} sessioni",
				"today_tokens_many": "{{amount}} token",
				"today_tokens_one": "{{amount}} token",
				"today_tokens_other": "{{amount}} token",
				"uptime_line": "Attivo da {{uptime}}",
				"uptime_line_version": "Attivo da {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "Errore",
				"running": "In esecuzione"
			},
			"sessionsPage": { "empty_title": "Nessuna sessione" }
		}
	},
	ja: {
		commandCenter: {
			"approve": "今回のみ承認",
			"attention_filter": "対応が必要",
			"blocked": "ブロック中",
			"explicit_input": "明示的に送信した場合にのみ、回答や承認が送られます。",
			"idle": "待機中",
			"no_input": "このカテゴリに対応待ちの項目はありません。",
			"open_session": "セッションを開く",
			"options_question": "このセッションはあなたの選択を待っています。",
			"reject": "今回のみ拒否",
			"reject_help": "今回のみ拒否すると、このリクエストを拒否します。権限モードは変わりません。",
			"running": "実行中",
			"send_answer": "回答を送信",
			"session_label": "セッション {{number}}",
			"stale": "一部の情報源を利用できません。最後に確認した状態は古い可能性があります。",
			"worker_label": "ワーカータスク {{number}}",
			"workflow_label": "ワークフロー {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "この承認は期限切れか、すでに決定済みか、新しいリクエストに置き換えられました — エージェントはもう待機していません。",
				"decision_failed": "この決定は記録されていない可能性があります — リクエストが失敗しました。",
				"decision_not_recorded_error": "この決定は記録されませんでした: {{error}}",
				"tool_approval_requested": "ツール承認がリクエストされました:"
			},
			"questionCard": { "or_type_a_custom_answer": "またはカスタム回答を入力…" }
		},
		pulse: {
			"answer_failed": "回答を送信できませんでした。",
			"answer_in_session": "セッションで回答する",
			"approval_pending": "ツールが承認を待っています",
			"gateway_unreachable": "ゲートウェイに接続できませんでした。",
			"sent": "送信済み",
			"sessions_unavailable": "セッションを読み込めませんでした。",
			"title": "Pulse",
			"wants_to_run": "{{tool}} の実行が求められています"
		},
		nav: {
			"crew_members": "Bot",
			"schedule": "スケジュール"
		},
		pages: {
			"homePage": {
				"active_now": "実行中",
				"approvals_count_other": "承認 {{amount}} 件",
				"bots_count": "{{total}} 件中 {{running}} 件が稼働中",
				"bots_unavailable": "Bot を読み込めませんでした。",
				"due": "{{when}}に実行",
				"failing_count_other": "失敗 {{amount}} 件",
				"fleet_all_resting": "すべて待機中です。",
				"fleet_resting_other": "{{amount}} 件が待機中",
				"fleet_title": "各エージェントの状況",
				"kind_session": "セッション",
				"kind_subagent": "サブエージェント",
				"kind_workflow": "ワークフロー",
				"last_active": "最終アクティビティ: {{when}}",
				"next_run": "次回: {{name}} {{when}}",
				"no_next_run": "予定されているジョブはありません",
				"now": "現在",
				"open": "開く",
				"open_overview": "設定 › 概要",
				"open_page": "ページを開く",
				"paused_count_other": "一時停止 {{amount}} 件",
				"questions_count_other": "質問 {{amount}} 件",
				"running_for": "実行中 {{duration}}",
				"schedule_unavailable": "スケジュールを読み込めませんでした。",
				"scheduled": "スケジュール済み",
				"spend_bar_label": "今日のモデル別使用量",
				"spend_none": "今日の使用量は記録されていません。",
				"spend_other": "その他のモデル",
				"spend_plan": "{{plan}} プラン: {{percent}} 使用",
				"spend_title": "消費トークン",
				"state_done": "完了",
				"state_stopped": "停止",
				"state_waiting": "待機中",
				"subagents_other": "{{amount}} サブエージェント",
				"subtitle": "クルーが今していること、あなたの対応を待っていること、そして次の予定。",
				"suggestions_count_other": "提案 {{amount}} 件",
				"today": "今日",
				"track_label": "この期間の {{name}} のアクティビティ",
				"upcoming": "今後の予定",
				"window_hours_other": "{{amount}} 時間",
				"window_label": "期間",
				"with_subagents": "サブエージェント実行中",
				"workflows_other": "{{amount}} ワークフロー",
				"show_all_other": "すべて表示（他 {{amount}} 件）"
			},
			"membersPage": { "empty_title": "Bot はまだありません" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "{{provider}} では使用量のトラッキングを利用できません。" } },
			"overviewPage": {
				"all_systems_running": "すべてのシステムが実行中",
				"connecting": "接続中…",
				"reconnecting": "再接続中…",
				"today_line": "本日: {{summary}}",
				"today_messages_other": "{{amount}} 件のメッセージ",
				"today_sessions_other": "{{amount}} セッション",
				"today_tokens_other": "{{amount}} トークン",
				"uptime_line": "稼働時間 {{uptime}}",
				"uptime_line_version": "稼働時間 {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "エラー",
				"running": "実行中"
			},
			"sessionsPage": { "empty_title": "セッションはありません" }
		}
	},
	ko: {
		commandCenter: {
			"approve": "이번만 승인",
			"attention_filter": "응답 필요",
			"blocked": "차단됨",
			"explicit_input": "명시적으로 제출한 경우에만 답변이나 승인이 전송됩니다.",
			"idle": "유휴",
			"no_input": "이 범주에는 처리를 기다리는 항목이 없습니다.",
			"open_session": "세션 열기",
			"options_question": "세션이 선택을 기다리고 있습니다.",
			"reject": "이번만 거부",
			"reject_help": "이번만 거부하면 이 요청을 거부합니다. 권한 모드는 그대로 유지됩니다.",
			"running": "실행 중",
			"send_answer": "답변 보내기",
			"session_label": "세션 {{number}}",
			"stale": "일부 소스를 사용할 수 없습니다. 마지막 상태가 오래되었을 수 있습니다.",
			"worker_label": "작업자 작업 {{number}}",
			"workflow_label": "워크플로 {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "이 승인은 만료되었거나, 이미 결정되었거나, 새 요청으로 대체되었습니다 — 에이전트가 더 이상 기다리지 않습니다.",
				"decision_failed": "이 결정이 기록되지 않았을 수 있습니다 — 요청이 실패했습니다.",
				"decision_not_recorded_error": "이 결정이 기록되지 않았습니다: {{error}}",
				"tool_approval_requested": "도구 승인 요청됨:"
			},
			"questionCard": { "or_type_a_custom_answer": "또는 답변을 직접 입력하세요…" }
		},
		pulse: {
			"answer_failed": "답변을 보낼 수 없습니다.",
			"answer_in_session": "세션에서 답하기",
			"approval_pending": "도구가 승인을 기다리고 있습니다",
			"gateway_unreachable": "게이트웨이에 연결할 수 없습니다.",
			"sent": "전송됨",
			"sessions_unavailable": "세션을 불러올 수 없습니다.",
			"title": "Pulse",
			"wants_to_run": "{{tool}} 실행을 요청합니다"
		},
		nav: {
			"crew_members": "Bot",
			"schedule": "스케줄"
		},
		pages: {
			"homePage": {
				"active_now": "현재 진행 중",
				"approvals_count_other": "승인 {{amount}}개",
				"bots_count": "{{total}}개 중 {{running}}개 작업 중",
				"bots_unavailable": "Bot을 불러올 수 없습니다.",
				"due": "{{when}} 실행",
				"failing_count_other": "실패 {{amount}}개",
				"fleet_all_resting": "모두 휴식 중입니다.",
				"fleet_resting_other": "휴식 중 {{amount}}개",
				"fleet_title": "각 에이전트가 하고 있는 일",
				"kind_session": "세션",
				"kind_subagent": "하위 에이전트",
				"kind_workflow": "워크플로",
				"last_active": "마지막 활동 {{when}}",
				"next_run": "다음: {{name}} {{when}}",
				"no_next_run": "예정된 작업이 없습니다",
				"now": "지금",
				"open": "열기",
				"open_overview": "설정 › 개요",
				"open_page": "페이지 열기",
				"paused_count_other": "일시중지 {{amount}}개",
				"questions_count_other": "질문 {{amount}}개",
				"running_for": "{{duration}} 실행 중",
				"schedule_unavailable": "스케줄을 불러올 수 없습니다.",
				"scheduled": "예정됨",
				"spend_bar_label": "오늘 모델별 사용량",
				"spend_none": "오늘 기록된 사용량이 없습니다.",
				"spend_other": "기타 모델",
				"spend_plan": "{{plan}} 플랜: {{percent}} 사용",
				"spend_title": "사용한 토큰",
				"state_done": "완료",
				"state_stopped": "중지됨",
				"state_waiting": "대기 중",
				"subagents_other": "하위 에이전트 {{amount}}개",
				"subtitle": "크루가 지금 하고 있는 일, 내 응답을 기다리는 일, 그리고 다음 예정.",
				"suggestions_count_other": "제안 {{amount}}개",
				"today": "오늘",
				"track_label": "이 기간의 {{name}} 활동",
				"upcoming": "예정",
				"window_hours_other": "{{amount}}시간",
				"window_label": "기간",
				"with_subagents": "하위 에이전트 실행 중",
				"workflows_other": "워크플로 {{amount}}개",
				"show_all_other": "모두 보기 ({{amount}}개 더)"
			},
			"membersPage": { "empty_title": "아직 Bot이 없음" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "{{provider}}에서는 사용량 추적을 사용할 수 없습니다." } },
			"overviewPage": {
				"all_systems_running": "모든 시스템 실행 중",
				"connecting": "연결 중…",
				"reconnecting": "다시 연결하는 중…",
				"today_line": "오늘: {{summary}}",
				"today_messages_other": "메시지 {{amount}}개",
				"today_sessions_other": "세션 {{amount}}개",
				"today_tokens_other": "토큰 {{amount}}개",
				"uptime_line": "{{uptime}} 동안 실행 중",
				"uptime_line_version": "{{uptime}} 동안 실행 중 · v{{version}}"
			},
			"schedulePage": {
				"error": "오류",
				"running": "실행 중"
			},
			"sessionsPage": { "empty_title": "세션이 없습니다" }
		}
	},
	pt: {
		commandCenter: {
			"approve": "Aprovar uma vez",
			"attention_filter": "Precisa de si",
			"blocked": "Bloqueado",
			"explicit_input": "Somente seu envio explícito transmite uma resposta ou aprovação.",
			"idle": "Inativo",
			"no_input": "Nada nesta categoria precisa de você.",
			"open_session": "Abrir sessão",
			"options_question": "A sessão está aguardando sua escolha.",
			"reject": "Rejeitar uma vez",
			"reject_help": "Rejeitar uma vez recusa esta solicitação. O modo de permissão continua igual.",
			"running": "Em execução",
			"send_answer": "Enviar resposta",
			"session_label": "Sessão {{number}}",
			"stale": "Algumas fontes estão indisponíveis. O último estado conhecido pode estar desatualizado.",
			"worker_label": "Tarefa do agente {{number}}",
			"workflow_label": "Fluxo de trabalho {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "Esta aprovação expirou, já foi decidida ou foi substituída por uma solicitação mais recente — o agente não está mais aguardando por ela.",
				"decision_failed": "Esta decisão pode não ter sido registrada — a solicitação falhou.",
				"decision_not_recorded_error": "Esta decisão não foi registrada: {{error}}",
				"tool_approval_requested": "Aprovação de ferramenta solicitada:"
			},
			"questionCard": { "or_type_a_custom_answer": "Ou digite uma resposta personalizada..." }
		},
		pulse: {
			"answer_failed": "A resposta não pôde ser enviada.",
			"answer_in_session": "Responder na sessão",
			"approval_pending": "Uma ferramenta aguarda aprovação",
			"gateway_unreachable": "O gateway não pôde ser alcançado.",
			"sent": "Enviado",
			"sessions_unavailable": "As sessões não puderam ser carregadas.",
			"title": "Pulse",
			"wants_to_run": "{{tool}} quer ser executado"
		},
		nav: {
			"crew_members": "Bots",
			"schedule": "Agendamentos"
		},
		pages: {
			"homePage": {
				"active_now": "Ativo agora",
				"approvals_count_many": "{{amount}} aprovações",
				"approvals_count_one": "{{amount}} aprovação",
				"approvals_count_other": "{{amount}} aprovações",
				"bots_count": "{{running}} de {{total}} a trabalhar",
				"bots_unavailable": "Não foi possível carregar os Bot.",
				"due": "Previsto {{when}}",
				"failing_count_many": "{{amount}} com erro",
				"failing_count_one": "{{amount}} com erro",
				"failing_count_other": "{{amount}} com erro",
				"fleet_all_resting": "Está tudo em repouso.",
				"fleet_resting_many": "{{amount}} em repouso",
				"fleet_resting_one": "{{amount}} em repouso",
				"fleet_resting_other": "{{amount}} em repouso",
				"fleet_title": "O que cada agente está a fazer",
				"kind_session": "Sessão",
				"kind_subagent": "Subagente",
				"kind_workflow": "Fluxo de trabalho",
				"last_active": "Última atividade {{when}}",
				"next_run": "Próximo: {{name}} {{when}}",
				"no_next_run": "Nenhuma tarefa pendente",
				"now": "Agora",
				"open": "Abrir",
				"open_overview": "Definições › Visão geral",
				"open_page": "Abrir página",
				"paused_count_many": "{{amount}} pausados",
				"paused_count_one": "{{amount}} pausado",
				"paused_count_other": "{{amount}} pausados",
				"questions_count_many": "{{amount}} perguntas",
				"questions_count_one": "{{amount}} pergunta",
				"questions_count_other": "{{amount}} perguntas",
				"running_for": "em execução há {{duration}}",
				"schedule_unavailable": "Não foi possível carregar os agendamentos.",
				"scheduled": "Agendados",
				"spend_bar_label": "Utilização de hoje por modelo",
				"spend_none": "Nenhuma utilização registada hoje.",
				"spend_other": "Outros modelos",
				"spend_plan": "Plano {{plan}}: {{percent}} utilizado",
				"spend_title": "Tokens consumidos",
				"state_done": "Concluído",
				"state_stopped": "Parado",
				"state_waiting": "Em espera",
				"subagents_many": "{{amount}} subagentes",
				"subagents_one": "{{amount}} subagente",
				"subagents_other": "{{amount}} subagentes",
				"subtitle": "O que a sua equipa está a fazer, o que espera por si e o que vem a seguir.",
				"suggestions_count_many": "{{amount}} sugestões",
				"suggestions_count_one": "{{amount}} sugestão",
				"suggestions_count_other": "{{amount}} sugestões",
				"today": "Hoje",
				"track_label": "Atividade de {{name}} neste período",
				"upcoming": "Próximos",
				"window_hours_many": "{{amount}} h",
				"window_hours_one": "{{amount}} h",
				"window_hours_other": "{{amount}} h",
				"window_label": "Período",
				"with_subagents": "Subagentes em execução",
				"workflows_many": "{{amount}} fluxos de trabalho",
				"workflows_one": "{{amount}} fluxo de trabalho",
				"workflows_other": "{{amount}} fluxos de trabalho",
				"show_all_many": "Mostrar tudo ({{amount}} a mais)",
				"show_all_one": "Mostrar tudo ({{amount}} a mais)",
				"show_all_other": "Mostrar tudo ({{amount}} a mais)"
			},
			"membersPage": { "empty_title": "Ainda não há Bots" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "O acompanhamento de uso não está disponível para {{provider}}." } },
			"overviewPage": {
				"all_systems_running": "Todos os sistemas em execução",
				"connecting": "Conectando…",
				"reconnecting": "Reconectando…",
				"today_line": "Hoje: {{summary}}",
				"today_messages_many": "{{amount}} mensagens",
				"today_messages_one": "{{amount}} mensagem",
				"today_messages_other": "{{amount}} mensagens",
				"today_sessions_many": "{{amount}} sessões",
				"today_sessions_one": "{{amount}} sessão",
				"today_sessions_other": "{{amount}} sessões",
				"today_tokens_many": "{{amount}} tokens",
				"today_tokens_one": "{{amount}} token",
				"today_tokens_other": "{{amount}} tokens",
				"uptime_line": "Ativo há {{uptime}}",
				"uptime_line_version": "Ativo há {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "Erro",
				"running": "Em execução"
			},
			"sessionsPage": { "empty_title": "Nenhuma sessão" }
		}
	},
	ru: {
		commandCenter: {
			"approve": "Разрешить один раз",
			"attention_filter": "Нужно твоё участие",
			"blocked": "Заблокировано",
			"explicit_input": "Ответ или разрешение отправляется только после твоего явного подтверждения.",
			"idle": "Бездействует",
			"no_input": "В этой категории ничто не требует твоего участия.",
			"open_session": "Открыть сессию",
			"options_question": "Сессия ждёт твоего выбора.",
			"reject": "Отклонить один раз",
			"reject_help": "Отклонить один раз отклоняет этот запрос. Режим разрешений не меняется.",
			"running": "В работе",
			"send_answer": "Отправить ответ",
			"session_label": "Сеанс {{number}}",
			"stale": "Некоторые источники недоступны. Последнее известное состояние может устареть.",
			"worker_label": "Задача агента {{number}}",
			"workflow_label": "Рабочий процесс {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "Срок этого запроса на одобрение истёк, решение по нему уже принято, или его заменил более новый запрос — агент больше его не ждёт.",
				"decision_failed": "Возможно, это решение не было записано — запрос не выполнен.",
				"decision_not_recorded_error": "Это решение не было записано: {{error}}",
				"tool_approval_requested": "Запрошено разрешение на инструмент:"
			},
			"questionCard": { "or_type_a_custom_answer": "Или введите свой ответ..." }
		},
		pulse: {
			"answer_failed": "Не удалось отправить ответ.",
			"answer_in_session": "Ответить в сессии",
			"approval_pending": "Инструмент ждёт одобрения",
			"gateway_unreachable": "Не удалось связаться со шлюзом.",
			"sent": "Отправлено",
			"sessions_unavailable": "Не удалось загрузить сессии.",
			"title": "Pulse",
			"wants_to_run": "{{tool}} хочет выполниться"
		},
		nav: {
			"crew_members": "Bot",
			"schedule": "Расписание"
		},
		pages: {
			"homePage": {
				"active_now": "Сейчас в работе",
				"approvals_count_few": "{{amount}} подтверждения",
				"approvals_count_many": "{{amount}} подтверждений",
				"approvals_count_one": "{{amount}} подтверждение",
				"approvals_count_other": "{{amount}} подтверждения",
				"bots_count": "{{running}} из {{total}} в работе",
				"bots_unavailable": "Не удалось загрузить Bot.",
				"due": "Запуск {{when}}",
				"failing_count_few": "{{amount}} с ошибкой",
				"failing_count_many": "{{amount}} с ошибкой",
				"failing_count_one": "{{amount}} с ошибкой",
				"failing_count_other": "{{amount}} с ошибкой",
				"fleet_all_resting": "Всё в состоянии покоя.",
				"fleet_resting_few": "{{amount}} в покое",
				"fleet_resting_many": "{{amount}} в покое",
				"fleet_resting_one": "{{amount}} в покое",
				"fleet_resting_other": "{{amount}} в покое",
				"fleet_title": "Чем занят каждый агент",
				"kind_session": "Сессия",
				"kind_subagent": "Субагент",
				"kind_workflow": "Рабочий процесс",
				"last_active": "Последняя активность {{when}}",
				"next_run": "Следующая: {{name}} {{when}}",
				"no_next_run": "Нет задач к запуску",
				"now": "Сейчас",
				"open": "Открыть",
				"open_overview": "Настройки › Обзор",
				"open_page": "Открыть страницу",
				"paused_count_few": "{{amount}} приостановлены",
				"paused_count_many": "{{amount}} приостановлено",
				"paused_count_one": "{{amount}} приостановлена",
				"paused_count_other": "{{amount}} приостановлено",
				"questions_count_few": "{{amount}} вопроса",
				"questions_count_many": "{{amount}} вопросов",
				"questions_count_one": "{{amount}} вопрос",
				"questions_count_other": "{{amount}} вопроса",
				"running_for": "в работе {{duration}}",
				"schedule_unavailable": "Не удалось загрузить расписание.",
				"scheduled": "Запланировано",
				"spend_bar_label": "Использование за сегодня по моделям",
				"spend_none": "Сегодня использование не зафиксировано.",
				"spend_other": "Другие модели",
				"spend_plan": "Тариф {{plan}}: использовано {{percent}}",
				"spend_title": "Потрачено токенов",
				"state_done": "Готово",
				"state_stopped": "Остановлено",
				"state_waiting": "Ожидает",
				"subagents_few": "{{amount}} субагента",
				"subagents_many": "{{amount}} субагентов",
				"subagents_one": "{{amount}} субагент",
				"subagents_other": "{{amount}} субагента",
				"subtitle": "Чем занята твоя команда, что ждёт твоего участия и что запланировано дальше.",
				"suggestions_count_few": "{{amount}} предложения",
				"suggestions_count_many": "{{amount}} предложений",
				"suggestions_count_one": "{{amount}} предложение",
				"suggestions_count_other": "{{amount}} предложения",
				"today": "Сегодня",
				"track_label": "Активность {{name}} за этот период",
				"upcoming": "Ближайшие",
				"window_hours_few": "{{amount}} ч",
				"window_hours_many": "{{amount}} ч",
				"window_hours_one": "{{amount}} ч",
				"window_hours_other": "{{amount}} ч",
				"window_label": "Период",
				"with_subagents": "Субагенты в работе",
				"workflows_few": "{{amount}} рабочих процесса",
				"workflows_many": "{{amount}} рабочих процессов",
				"workflows_one": "{{amount}} рабочий процесс",
				"workflows_other": "{{amount}} рабочего процесса",
				"show_all_few": "Показать все (ещё {{amount}})",
				"show_all_many": "Показать все (ещё {{amount}})",
				"show_all_one": "Показать все (ещё {{amount}})",
				"show_all_other": "Показать все (ещё {{amount}})"
			},
			"membersPage": { "empty_title": "Bot пока нет" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "Отслеживание использования недоступно для {{provider}}." } },
			"overviewPage": {
				"all_systems_running": "Все системы работают",
				"connecting": "Подключение…",
				"reconnecting": "Переподключение…",
				"today_line": "Сегодня: {{summary}}",
				"today_messages_few": "{{amount}} сообщения",
				"today_messages_many": "{{amount}} сообщений",
				"today_messages_one": "{{amount}} сообщение",
				"today_messages_other": "{{amount}} сообщения",
				"today_sessions_few": "{{amount}} сессии",
				"today_sessions_many": "{{amount}} сессий",
				"today_sessions_one": "{{amount}} сессия",
				"today_sessions_other": "{{amount}} сессии",
				"today_tokens_few": "{{amount}} токена",
				"today_tokens_many": "{{amount}} токенов",
				"today_tokens_one": "{{amount}} токен",
				"today_tokens_other": "{{amount}} токена",
				"uptime_line": "Работает {{uptime}}",
				"uptime_line_version": "Работает {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "Ошибка",
				"running": "Выполняется"
			},
			"sessionsPage": { "empty_title": "Нет сессий" }
		}
	},
	"zh-CN": {
		commandCenter: {
			"approve": "批准本次",
			"attention_filter": "需要你处理",
			"blocked": "受阻",
			"explicit_input": "只有你明确提交后，才会发送回答或审批决定。",
			"idle": "空闲",
			"no_input": "此类别暂无需要你处理的事项。",
			"open_session": "打开会话",
			"options_question": "该会话正在等你做出选择。",
			"reject": "拒绝本次",
			"reject_help": "拒绝本次会拒绝此请求，权限模式保持不变。",
			"running": "运行中",
			"send_answer": "发送回答",
			"session_label": "会话 {{number}}",
			"stale": "部分数据源不可用，当前显示的最近状态可能已过期。",
			"worker_label": "工作任务 {{number}}",
			"workflow_label": "工作流 {{number}}"
		},
		components: {
			"approvalCard": {
				"approval_no_longer_pending": "这条审批已过期、已被处理，或已被更新的请求取代 — 代理不再等待它。",
				"decision_failed": "这次决定可能未被记录 — 请求失败。",
				"decision_not_recorded_error": "这次决定未被记录：{{error}}",
				"tool_approval_requested": "已请求工具审批："
			},
			"questionCard": { "or_type_a_custom_answer": "或输入自定义回答…" }
		},
		pulse: {
			"answer_failed": "无法发送回答。",
			"answer_in_session": "在会话中回答",
			"approval_pending": "有工具正在等待批准",
			"gateway_unreachable": "无法连接网关。",
			"sent": "已发送",
			"sessions_unavailable": "无法加载会话。",
			"title": "Pulse",
			"wants_to_run": "{{tool}} 请求运行"
		},
		nav: {
			"crew_members": "Bot",
			"schedule": "日程"
		},
		pages: {
			"homePage": {
				"active_now": "进行中",
				"approvals_count_other": "{{amount}} 个审批",
				"bots_count": "{{total}} 个中有 {{running}} 个在工作",
				"bots_unavailable": "无法加载 Bot。",
				"due": "{{when}}到期",
				"failing_count_other": "{{amount}} 个失败",
				"fleet_all_resting": "一切都处于空闲状态。",
				"fleet_resting_other": "{{amount}} 个空闲",
				"fleet_title": "每个代理正在做什么",
				"kind_session": "会话",
				"kind_subagent": "子代理",
				"kind_workflow": "工作流",
				"last_active": "上次活动 {{when}}",
				"next_run": "下一次：{{name}} {{when}}",
				"no_next_run": "没有待执行的任务",
				"now": "现在",
				"open": "打开",
				"open_overview": "设置 › 概览",
				"open_page": "打开页面",
				"paused_count_other": "{{amount}} 个已暂停",
				"questions_count_other": "{{amount}} 个问题",
				"running_for": "已运行 {{duration}}",
				"schedule_unavailable": "无法加载日程。",
				"scheduled": "已排期",
				"spend_bar_label": "今天各模型的用量",
				"spend_none": "今天没有记录到用量。",
				"spend_other": "其他模型",
				"spend_plan": "{{plan}} 套餐：已使用 {{percent}}",
				"spend_title": "消耗的令牌",
				"state_done": "已完成",
				"state_stopped": "已停止",
				"state_waiting": "等待中",
				"subagents_other": "{{amount}} 个子代理",
				"subtitle": "你的团队在做什么、哪些事项在等你处理，以及接下来有什么安排。",
				"suggestions_count_other": "{{amount}} 条建议",
				"today": "今天",
				"track_label": "{{name}} 在此时间段内的活动",
				"upcoming": "即将执行",
				"window_hours_other": "{{amount}} 小时",
				"window_label": "时间范围",
				"with_subagents": "子代理运行中",
				"workflows_other": "{{amount}} 个工作流",
				"show_all_other": "显示全部（还有 {{amount}} 个）"
			},
			"membersPage": { "empty_title": "还没有 Bot" },
			"overview": { "usageTab": { "usage_tracking_is_not_available_for": "{{provider}} 不支持用量跟踪。" } },
			"overviewPage": {
				"all_systems_running": "所有系统运行中",
				"connecting": "正在连接…",
				"reconnecting": "正在重连…",
				"today_line": "今天：{{summary}}",
				"today_messages_other": "{{amount}} 条消息",
				"today_sessions_other": "{{amount}} 个会话",
				"today_tokens_other": "{{amount}} 个令牌",
				"uptime_line": "已运行 {{uptime}}",
				"uptime_line_version": "已运行 {{uptime}} · v{{version}}"
			},
			"schedulePage": {
				"error": "错误",
				"running": "运行中"
			},
			"sessionsPage": { "empty_title": "暂无会话" }
		}
	}
};
var own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
function lookup(catalog, key) {
	let node = catalog;
	for (const part of key.split(".")) {
		if (node === void 0 || typeof node === "string" || !own(node, part)) return void 0;
		node = node[part];
	}
	return typeof node === "string" ? node : void 0;
}
/** The catalogs to try for `locale`, most specific first, always ending in English. */
function localeChain(locale) {
	const chain = [];
	const add = (candidate) => {
		if (own(CATALOGS, candidate) && !chain.includes(candidate)) chain.push(candidate);
	};
	add(locale);
	add(locale.split("-")[0]);
	add("en");
	return chain;
}
function currentLocale() {
	try {
		const locale = activeLocale();
		return typeof locale === "string" && locale ? locale : "en";
	} catch {
		return "en";
	}
}
var PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
function pluralForm(locale, count) {
	try {
		return new Intl.PluralRules(locale).select(count);
	} catch {
		return count === 1 ? "one" : "other";
	}
}
function t(key, vars) {
	const count = vars && typeof vars.count === "number" ? vars.count : void 0;
	for (const locale of localeChain(currentLocale())) {
		const catalog = CATALOGS[locale];
		let text;
		if (count !== void 0) text = lookup(catalog, `${key}_${pluralForm(locale, count)}`) ?? lookup(catalog, `${key}_other`);
		text = text ?? lookup(catalog, key);
		if (text !== void 0) return text.replace(PLACEHOLDER, (whole, name) => vars && own(vars, name) ? String(vars[name]) : whole);
	}
	return key;
}
// src/ActivityTrack.tsx
/**
* One row's activity over the board's window: a bar per turn, a brighter bar for
* the run in progress, and a dot where the row asked for a decision or failed.
* Theme tokens only; positions are percentages of the track, which is the one
* place an inline style is the right tool.
*/
function ActivityTrack({ spans, live, markers, thin = false, label }) {
	return /* @__PURE__ */ jsxs("div", {
		role: "img",
		"aria-label": t("pages.homePage.track_label", { name: label }),
		className: `relative w-full ${thin ? "h-1.5" : "h-2.5"} rounded-full bg-bg-elevated`,
		"data-testid": "home-track",
		children: [
			spans.map((s, i) => /* @__PURE__ */ jsx("span", {
				className: "absolute inset-y-0 rounded-full ch-accent-50",
				style: {
					left: `${s.leftPct}%`,
					width: `${s.widthPct}%`
				},
				"data-testid": "home-track-span"
			}, i)),
			live && /* @__PURE__ */ jsx("span", {
				className: "absolute inset-y-0 rounded-full bg-accent animate-pulse",
				style: {
					left: `${live.leftPct}%`,
					width: `${live.widthPct}%`
				},
				"data-testid": "home-track-live"
			}),
			markers?.map((m, i) => /* @__PURE__ */ jsx("span", {
				className: `absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-bg ${thin ? "w-2.5 h-2.5" : "w-3.5 h-3.5"} ${m.kind === "ask" ? "bg-warn" : "bg-danger"}`,
				style: { left: `${m.atPct}%` },
				"data-testid": `home-track-${m.kind}`
			}, `m${i}`))
		]
	});
}
// src/format.ts
/**
* Locale-aware formatting the host SDK does not export, built on the same
* `Intl` services the dashboard uses, in the host's active language. The SDK
* supplies `fmtNumber`, `fmtCurrency`, `fmtTime` and `fmtRelative`; these are
* the five the page needs beyond them.
*/
/** `1.2K`, `3.4M`: a number abbreviated as the dashboard abbreviates tokens. */
function fmtCompact(value) {
	if (!Number.isFinite(value)) return "—";
	return fmtNumber(value, {
		notation: "compact",
		maximumFractionDigits: 1
	});
}
/** The quantity `fmtCompact(value)` shows, for picking a plural form that
*  agrees with the number on screen: `1.2K` is 1200, so a plural keyed on
*  1200 is right where one keyed on the exact 1234 might not be. */
function compactPluralCount(value) {
	if (!Number.isFinite(value) || value === 0) return value;
	try {
		const parts = new Intl.NumberFormat(currentLocale(), {
			notation: "compact",
			maximumFractionDigits: 1,
			numberingSystem: "latn"
		}).formatToParts(value);
		if (!parts.some((p) => p.type === "compact")) return value;
		const integer = parts.filter((p) => p.type === "integer").map((p) => p.value).join("");
		const fraction = parts.find((p) => p.type === "fraction")?.value ?? "";
		const shown = Number(`${integer || "0"}.${fraction || "0"}`);
		const digits = Math.floor(Math.log10(Math.abs(value))) - Math.floor(Math.log10(Math.abs(shown)));
		return Math.round(shown * 10 ** digits);
	} catch {
		return value;
	}
}
/** `a, b, and c` in the locale's own list style. */
function fmtList(items) {
	const kept = items.filter(Boolean);
	try {
		return new Intl.ListFormat(currentLocale(), {
			type: "conjunction",
			style: "long"
		}).format(kept);
	} catch {
		return kept.join(", ");
	}
}
/** `42%`, floored so a share at 99.6% does not read as the whole. */
function fmtPercentFloor(ratio) {
	if (!Number.isFinite(ratio)) return "—";
	const floored = Math.floor(ratio * 100) / 100;
	return fmtNumber(floored, {
		style: "percent",
		maximumFractionDigits: 0
	});
}
/** A dollar figure the way the dashboard writes cost: `~$0` for nothing,
*  `<$0.01` under a cent, otherwise the locale's currency form. */
function formatCost(usd) {
	if (usd == null || !Number.isFinite(usd)) return "—";
	if (usd === 0) return "~$0";
	const abs = Math.abs(usd);
	const sign = usd < 0 ? "-" : "";
	if (abs < .01) return `${sign}<${fmtCurrency(.01)}`;
	return `${sign}${fmtCurrency(abs)}`;
}
/** A run's age as whole hours and minutes (`2h 5m`, `7m`), the way a glance
*  reads it; `0m` for a run under a minute. */
function fmtElapsedMinutes(sinceMs, nowMs) {
	const minutes = Math.max(0, Math.floor((nowMs - sinceMs) / 6e4));
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	const unit = (n, u) => fmtNumber(n, {
		style: "unit",
		unit: u,
		unitDisplay: "narrow"
	});
	if (!hours) return unit(rest, "minute");
	return rest ? `${unit(hours, "hour")} ${unit(rest, "minute")}` : unit(hours, "hour");
}
// src/model.ts
/** How long a failed workflow counts as blocked. Past it the run rests as
*  stopped; the Workflows page still lists it. */
var FAILED_WORKFLOW_BLOCKED_MS = 864e5;
/** Session keys from the workflow and spawn APIs may be scope-qualified;
*  slot keys are not. */
function slotKey(key) {
	return key.startsWith("dashboard:") ? key.slice(10) : key;
}
/** A session a person opened, as opposed to a Bot's pinned thread (listed under
*  Bots) or a slot with no key. */
function isBoardSlot(slot) {
	return !!slot.key && slot.mode !== "member";
}
/** The dashboard's placeholder title for a session nobody named yet. */
function sessionTitle(slot) {
	const title = slot.title?.trim() ?? "";
	return title && title !== slot.key ? title : "";
}
/** The choices an idle session's newest reply offers, or none when it is not
*  waiting on them: the session is running or interrupted, or a queued prompt
*  may already be the answer. */
function offeredOptions(slot) {
	const offered = slot.has_options ? (slot.options ?? []).filter(Boolean) : [];
	if (!offered.length || slot.running || slot.interrupted || (slot.queue_depth ?? 0) > 0) return [];
	return offered;
}
/** A `$name` token loads a skill body from anywhere in a sent string; the
*  dashboard's send path reads the same pattern. */
var SKILL_TOKEN_RE = /(?<![\w$])\$[a-z0-9][a-z0-9/_-]*/;
/** A label that, sent bare, would run rather than say: one opening with a
*  harness command or mention sigil, or carrying a skill or paste token. The
*  dashboard's own rule (`dispatchIsCommandShaped`); such a label is answered in
*  the session itself, never from here. */
function isCommandShaped(label) {
	const text = label.trim();
	if (!text) return false;
	if (text.startsWith("/") || text.startsWith("@")) return true;
	if (SKILL_TOKEN_RE.test(text)) return true;
	return text.includes("[ Paste #");
}
function failedWorkflowState(endedAt, now) {
	const ended = endedAt ? Date.parse(endedAt) : NaN;
	return Number.isFinite(ended) && now - ended > FAILED_WORKFLOW_BLOCKED_MS ? "stopped" : "blocked";
}
function subagentState(agent) {
	if (agent.done) {
		if (agent.outcome === "failed" || agent.error) return "blocked";
		if (agent.outcome === "stopped" || agent.stopped) return "stopped";
		return "done";
	}
	if (agent.stopped) return "stopped";
	if (agent.awaiting_approval) return "needs_input";
	return "running";
}
function workflowState(run, now) {
	switch (run.status) {
		case "finished": return "done";
		case "failed": return failedWorkflowState(run.ended_at, now);
		case "cancelled": return "stopped";
		case "paused":
		case "pausing": return "waiting";
		case "running":
		case "planning":
		case "planned": return "running";
		default: return "idle";
	}
}
/** Every node and every item that needs a person, from the five reads. */
function buildFleet(source, now = Date.now()) {
	const slots = source.slots.filter(isBoardSlot);
	const keys = new Set(slots.map((s) => s.key));
	const attention = [];
	const seen = /* @__PURE__ */ new Set();
	const add = (item) => {
		if (!seen.has(item.id)) {
			seen.add(item.id);
			attention.push(item);
		}
	};
	const has = (slot, kind) => attention.some((a) => a.slot === slot && a.kind === kind);
	for (const q of source.questions) {
		const slot = slotKey(q.slot);
		if (keys.has(slot)) add({
			id: `question:${slot}:${q.ask_id || q.card_id || slot}`,
			slot,
			kind: "question",
			question: q
		});
	}
	for (const s of slots) {
		const offered = offeredOptions(s);
		if (!offered.length || has(s.key, "question")) continue;
		add({
			id: `options:${s.key}:${s.options_ts ?? ""}:${offered.join("\0")}`,
			slot: s.key,
			kind: "follow_up",
			followUp: {
				slot: s.key,
				labels: offered
			}
		});
	}
	for (const approval of source.approvals) {
		const slot = slotKey(approval.slot ?? "");
		if (keys.has(slot)) add({
			id: `approval:${slot}:${approval.id}:${approval.instance ?? ""}`,
			slot,
			kind: "approval",
			approval
		});
	}
	for (const s of slots) {
		if (s.pending_approval && !has(s.key, "approval")) add({
			id: `session-approval:${s.key}`,
			slot: s.key,
			kind: "approval"
		});
		if (s.needs_input && !attention.some((a) => a.slot === s.key && a.kind !== "follow_up")) add({
			id: `session-input:${s.key}`,
			slot: s.key,
			kind: "open_session"
		});
	}
	const nodes = slots.map((s, index) => ({
		id: `session:${s.key}`,
		kind: "session",
		ref: s.key,
		slot: s.key,
		title: sessionTitle(s),
		ordinal: index + 1,
		state: s.needs_input || s.pending_approval ? "needs_input" : s.running || s.subagents_running || (s.queue_depth ?? 0) - (s.queue_held_depth ?? 0) > 0 ? "running" : "idle",
		detail: s.todo?.current || void 0
	}));
	const agentIds = /* @__PURE__ */ new Set();
	for (const a of source.subagents) {
		const slot = slotKey(a.parent ?? "");
		if (!keys.has(slot) || agentIds.has(a.id)) continue;
		agentIds.add(a.id);
		nodes.push({
			id: `subagent:${a.id}`,
			kind: "subagent",
			ref: a.id,
			slot,
			title: a.task !== a.id ? a.task : "",
			ordinal: nodes.length + 1,
			state: subagentState(a),
			detail: a.last_tool || void 0,
			error: a.error || void 0
		});
	}
	for (const w of source.workflows) {
		const slot = slotKey(w.session_key ?? "");
		if (!keys.has(slot)) continue;
		nodes.push({
			id: `workflow:${w.run_id}`,
			kind: "workflow",
			ref: w.run_id,
			slot,
			title: w.name && w.name !== w.run_id ? w.name : "",
			ordinal: nodes.length + 1,
			state: workflowState(w, now),
			detail: w.last_log,
			error: w.error || void 0
		});
	}
	return {
		nodes,
		attention
	};
}
function splitAttention(items) {
	const followUps = items.filter((i) => i.kind === "follow_up");
	const blockers = items.filter((i) => i.kind !== "follow_up");
	return {
		blockers,
		followUps,
		questions: blockers.filter((i) => i.kind === "question" || i.kind === "open_session").length,
		approvals: blockers.filter((i) => i.kind === "approval").length
	};
}
function rowExtras(slot) {
	const since = slot?.running && slot.last_turn_ts ? Date.parse(slot.last_turn_ts) : NaN;
	return {
		runningSinceMs: Number.isNaN(since) ? void 0 : since,
		lastMessage: slot?.last_message?.trim() || void 0,
		subagentsRunning: !!slot?.subagents_running
	};
}
function activeCounts(nodes) {
	const running = nodes.filter((n) => n.state === "running");
	const by = (kind) => running.filter((n) => n.kind === kind).length;
	return {
		sessions: by("session"),
		subagents: by("subagent"),
		workflows: by("workflow"),
		total: running.length
	};
}
/** Reading order: what a person must act on first, then what is blocked, then
*  what is working; the rest is at rest. Ties keep source order. */
var STATE_RANK = {
	needs_input: 0,
	blocked: 1,
	running: 2,
	waiting: 3,
	idle: 4,
	done: 5,
	stopped: 6
};
var RESTING = /* @__PURE__ */ new Set([
	"idle",
	"done",
	"stopped"
]);
/** A paused workflow waits on nobody, so it rests. */
function isResting(node) {
	return RESTING.has(node.state) || node.kind === "workflow" && node.state === "waiting";
}
/** Nodes in reading order, split into the ones worth a row and the ones at
*  rest. A session with a blocker in the inbox reads `needs_input` whatever its
*  flags say, so the row never contradicts the card beside it. */
function orderFleet(nodes, attentionSlots = /* @__PURE__ */ new Set()) {
	const sorted = nodes.map((n) => n.kind === "session" && attentionSlots.has(n.slot) && n.state !== "needs_input" ? {
		...n,
		state: "needs_input"
	} : n).sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state]);
	return {
		active: sorted.filter((n) => !isResting(n)),
		resting: sorted.filter(isResting)
	};
}
function scheduleSummary(jobs) {
	const enabled = jobs.filter((j) => j.enabled);
	return {
		enabled: enabled.length,
		paused: jobs.length - enabled.length,
		failing: enabled.filter((j) => j.last_status === "error").length,
		running: jobs.filter((j) => j.is_running).length,
		next: upcomingJobs(jobs, 1)[0] ?? null
	};
}
/** Enabled jobs with a forecast run, soonest first. */
function upcomingJobs(jobs, limit) {
	return jobs.filter((j) => j.enabled && typeof j.next_run_ts === "number").sort((a, b) => a.next_run_ts - b.next_run_ts).slice(0, limit);
}
/** The Bots panel's count: crewmates mid-turn over the roster size. */
function botCounts(rows) {
	return {
		running: rows.filter((r) => r.running).length,
		total: rows.length
	};
}
function tokensOf(bucket) {
	return (bucket.input ?? 0) + (bucket.output ?? 0) + (bucket.cache_create ?? 0) + (bucket.cache_read ?? 0);
}
/** Today's usage by model, largest first, the smallest folded into one "other"
*  row once there are more than `limit`. A model with nothing to show is dropped. */
function spendByModel(models, dollars, limit, otherLabel) {
	const measure = (b) => dollars ? b.cost_usd ?? 0 : tokensOf(b);
	const rows = Object.entries(models ?? {}).map(([model, bucket]) => ({
		model,
		amount: measure(bucket)
	})).filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
	if (rows.length <= limit) return rows;
	return [...rows.slice(0, limit - 1), {
		model: otherLabel,
		amount: rows.slice(limit - 1).reduce((sum, r) => sum + r.amount, 0)
	}];
}
/** The harnesses whose turns record a dollar cost. Every other harness reports
*  tokens, so the Today tile and the spend panel show tokens there. */
var DOLLAR_HARNESSES = ["claude"];
function reportsDollars(backend) {
	return backend !== void 0 && DOLLAR_HARNESSES.includes(backend);
}
// src/states.ts
var STATE = {
	needs_input: {
		variant: "warn",
		key: "commandCenter.attention_filter"
	},
	blocked: {
		variant: "err",
		key: "commandCenter.blocked"
	},
	running: {
		variant: "aim",
		key: "commandCenter.running"
	},
	waiting: {
		variant: "muted",
		key: "pages.homePage.state_waiting"
	},
	idle: {
		variant: "muted",
		key: "commandCenter.idle"
	},
	done: {
		variant: "ok",
		key: "pages.homePage.state_done"
	},
	stopped: {
		variant: "muted",
		key: "pages.homePage.state_stopped"
	}
};
/** The badge a card wears once its answer or decision has gone out. */
var SENT = {
	variant: "ok",
	key: "pulse.sent"
};
// src/timeline.ts
/** The windows the board offers, in hours. */
var TIMELINE_HOURS = [
	6,
	12,
	24
];
function timelineWindow(hours, nowMs) {
	return {
		startMs: nowMs - hours * 36e5,
		endMs: nowMs
	};
}
function spanOn(window, startMs, endMs, minPct = .4) {
	const total = window.endMs - window.startMs;
	if (total <= 0) return null;
	const start = Math.max(window.startMs, Math.min(startMs, endMs));
	const end = Math.min(window.endMs, Math.max(startMs, endMs));
	if (end < window.startMs || start > window.endMs) return null;
	const leftPct = (start - window.startMs) / total * 100;
	const widthPct = Math.max(minPct, (end - start) / total * 100);
	return {
		leftPct: Math.min(leftPct, 100 - minPct),
		widthPct: Math.min(widthPct, 100 - leftPct)
	};
}
/** An instant's place on the track, or null when outside the window. */
function pointOn(window, atMs) {
	if (atMs < window.startMs || atMs > window.endMs) return null;
	return (atMs - window.startMs) / (window.endMs - window.startMs) * 100;
}
/** Evenly spaced axis ticks, the window's start included and its end excluded
*  (the end is labelled "now" by the caller). */
function tickTimes(window, count) {
	const step = (window.endMs - window.startMs) / count;
	return Array.from({ length: count }, (_, i) => window.startMs + i * step);
}
/** Turn rows as spans, oldest first, each at least a sliver long. The gateway
*  stamps a row when the turn ENDS, so a span runs from `ts - duration_ms` to
*  `ts`. A row whose timestamp does not parse is dropped: an undatable turn
*  cannot be placed. */
function turnSpans(rows, window) {
	return rows.map((row) => {
		const at = Date.parse(row.ts);
		if (Number.isNaN(at)) return null;
		return spanOn(window, at - Math.max(0, row.duration_ms ?? 0), at);
	}).filter((s) => s !== null);
}
/** The query string `GET /api/usage/turns` takes for this window. */
function turnsRange(window) {
	return `since=${Math.floor(window.startMs / 1e3)}&until=${Math.ceil(window.endMs / 1e3)}`;
}
// src/queries.ts
/**
* The page's reads as React Query options, one per gateway route, so every
* section that needs the same list shares one cache entry. The host gives the
* bundle its own query client, so these keys collide with nothing.
*
* Refresh: the slot list, questions and approvals re-read when the host's
* `slots` event says the list changed (`useFleetRefresh`), and every read polls
* at a slow cadence as a floor, so a change the socket does not announce still
* lands within a minute.
*/
/** The slow floor under the live refresh, in milliseconds. */
var POLL_MS = 6e4;
/** The schedule, roster and usage change rarely; read them less often. */
var SLOW_POLL_MS = 3e5;
var slotsQuery = queryOptions({
	queryKey: ["crew-pulse", "slots"],
	queryFn: reads.slots,
	refetchInterval: POLL_MS,
	staleTime: 5e3
});
var questionsQuery = queryOptions({
	queryKey: ["crew-pulse", "questions"],
	queryFn: reads.questions,
	refetchInterval: POLL_MS,
	staleTime: 5e3
});
var approvalsQuery = queryOptions({
	queryKey: ["crew-pulse", "approvals"],
	queryFn: reads.approvals,
	refetchInterval: POLL_MS,
	staleTime: 5e3
});
var subagentsQuery = queryOptions({
	queryKey: ["crew-pulse", "subagents"],
	queryFn: reads.subagents,
	refetchInterval: POLL_MS,
	staleTime: 5e3
});
var workflowsQuery = queryOptions({
	queryKey: ["crew-pulse", "workflows"],
	queryFn: reads.workflows,
	refetchInterval: POLL_MS,
	staleTime: 5e3
});
var cronsQuery = queryOptions({
	queryKey: ["crew-pulse", "crons"],
	queryFn: reads.crons,
	refetchInterval: SLOW_POLL_MS,
	staleTime: 3e4
});
var membersQuery = queryOptions({
	queryKey: ["crew-pulse", "members"],
	queryFn: reads.members,
	refetchInterval: SLOW_POLL_MS,
	staleTime: 3e4
});
var usageQuery = queryOptions({
	queryKey: ["crew-pulse", "usage"],
	queryFn: reads.usage,
	refetchInterval: SLOW_POLL_MS,
	staleTime: 3e4
});
var statusQuery = queryOptions({
	queryKey: ["crew-pulse", "status"],
	queryFn: reads.status,
	refetchInterval: POLL_MS,
	staleTime: 5e3
});
var configQuery = queryOptions({
	queryKey: ["crew-pulse", "config"],
	queryFn: reads.config,
	staleTime: Infinity
});
/** The keys the `slots` event invalidates: what a turn, an answer or a decision
*  changes. The schedule, roster and usage are not among them. */
var LIVE_KEYS = [
	slotsQuery.queryKey,
	questionsQuery.queryKey,
	approvalsQuery.queryKey,
	subagentsQuery.queryKey,
	workflowsQuery.queryKey
];
/** Re-read the live sources when the host says the slot list changed. */
function useFleetRefresh() {
	const client = useQueryClient();
	useAppEvents("slots", () => {
		for (const key of LIVE_KEYS) client.invalidateQueries({ queryKey: key });
	});
}
var WIDEST_HOURS = TIMELINE_HOURS[TIMELINE_HOURS.length - 1];
/** A session's turns over the board's widest window. Always the 24-hour
*  superset, so switching 6/12/24 costs no request; off for rows the board is
*  not drawing. `nowMs` is read to the minute, so the key moves once a minute. */
function useTurnHistory(slot, nowMs, enabled) {
	const range = turnsRange(timelineWindow(WIDEST_HOURS, nowMs));
	return useQuery({
		queryKey: [
			"crew-pulse",
			"turns",
			slot,
			range
		],
		queryFn: () => reads.turns(slot, range),
		enabled,
		staleTime: 6e4,
		gcTime: 3e5,
		retry: false
	});
}
/** The window's end, read to the minute, so the board's clock ticks once a
*  minute rather than once a render. */
function useMinuteClock() {
	const [now, setNow] = useState(() => minuteFloor(Date.now()));
	useEffect(() => {
		const id = setInterval(() => setNow(minuteFloor(Date.now())), 15e3);
		return () => clearInterval(id);
	}, []);
	return now;
}
function minuteFloor(ms) {
	return Math.floor(ms / 6e4) * 6e4;
}
// src/rows.tsx
function Section({ label, count, trailing, children, testId }) {
	return /* @__PURE__ */ jsxs("section", {
		"aria-label": label,
		className: "space-y-3",
		"data-testid": testId,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center gap-2 min-w-0",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "text-[12.5px] font-semibold text-text-strong",
					children: label
				}),
				count !== void 0 && /* @__PURE__ */ jsx("span", {
					className: "text-[12px] text-muted tabular-nums",
					"data-testid": `${testId}-count`,
					children: count
				}),
				/* @__PURE__ */ jsx("span", {
					className: "flex-1 border-t border-border",
					"aria-hidden": "true"
				}),
				trailing
			]
		}), children]
	});
}
function ListRow({ children, className = "", ...rest }) {
	return /* @__PURE__ */ jsx("li", {
		className: `flex items-center gap-3 min-w-0 py-2 border-t border-border first:border-t-0 ${className}`,
		...rest,
		children
	});
}
/** A link into the dashboard, through the host's router so the page does not reload. */
function RowLink({ to, children }) {
	const navigate = useNavigate();
	return /* @__PURE__ */ jsxs("a", {
		href: to,
		onClick: (e) => {
			e.preventDefault();
			navigate(to);
		},
		className: "text-accent text-[12px] inline-flex min-h-8 items-center gap-1 shrink-0 no-underline",
		children: [children, /* @__PURE__ */ jsx(ArrowUpRight, { size: 13 })]
	});
}
/** The chat route for a session. */
var sessionRoute = (slot) => `/chat?sid=${encodeURIComponent(slot)}`;
// src/FleetBoard.tsx
/**
* The agent board: one row per session with its subagents and workflows nested
* under it, each with an activity track over a rolling window (6, 12 or 24
* hours). Rows come in reading order (what needs a person, then blocked,
* working, waiting); sessions wholly at rest fold behind a count so the board
* stays as long as the work, not as long as the history.
*/
var KIND_KEY = {
	session: "pages.homePage.kind_session",
	subagent: "pages.homePage.kind_subagent",
	workflow: "pages.homePage.kind_workflow"
};
var LABEL_KEY = {
	session: "commandCenter.session_label",
	subagent: "commandCenter.worker_label",
	workflow: "commandCenter.workflow_label"
};
var AXIS_TICKS = 6;
/** The node's name, or the dashboard's numbered placeholder for an unnamed one. */
function runTitle(node) {
	return node.title || t(LABEL_KEY[node.kind], { number: fmtNumber(node.ordinal) });
}
/** Badge, text, track, link: the board's four columns, shared by every row and
*  by the axis under them so the tracks and the tick marks line up. */
var COLUMNS = "ch-board-cols items-center gap-3";
function RowText({ node, extras, nowMs }) {
	const line = node.error || node.detail || (node.kind === "session" ? extras?.lastMessage : void 0);
	const running = node.state === "running";
	return /* @__PURE__ */ jsxs("div", {
		className: "flex-1 min-w-0",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-baseline gap-x-2 min-w-0",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: `${node.kind === "session" ? "text-sm font-medium" : "text-[13px]"} truncate max-w-full`,
					children: runTitle(node)
				}),
				node.kind !== "session" && /* @__PURE__ */ jsx("span", {
					className: "text-[11px] text-muted shrink-0",
					children: t(KIND_KEY[node.kind])
				}),
				running && extras?.runningSinceMs != null && /* @__PURE__ */ jsx("span", {
					className: "text-[11px] text-muted shrink-0",
					"data-testid": "home-fleet-elapsed",
					children: t("pages.homePage.running_for", { duration: fmtElapsedMinutes(extras.runningSinceMs, nowMs) })
				}),
				node.kind === "session" && extras?.subagentsRunning && /* @__PURE__ */ jsx("span", {
					className: "text-[11px] text-muted shrink-0",
					children: t("pages.homePage.with_subagents")
				})
			]
		}), line && /* @__PURE__ */ jsx("div", {
			className: `text-[12px] truncate ${node.error ? "text-danger-text" : "text-muted"}`,
			children: line
		})]
	});
}
function BoardRow({ node, extras, timeline, track, child = false }) {
	const state = STATE[node.state];
	return /* @__PURE__ */ jsx("li", {
		className: child ? "py-1.5 pl-6 border-t border-border/60" : "py-2 border-t border-border first:border-t-0",
		"data-testid": "home-fleet-row",
		"data-state": node.state,
		children: /* @__PURE__ */ jsxs("div", {
			className: `grid ${COLUMNS}`,
			children: [
				/* @__PURE__ */ jsxs(Badge, {
					variant: state.variant,
					className: "shrink-0",
					children: [!child && node.state === "running" && /* @__PURE__ */ jsx("span", { className: "inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1 align-middle" }), t(state.key)]
				}),
				/* @__PURE__ */ jsx(RowText, {
					node,
					extras,
					nowMs: timeline.endMs
				}),
				/* @__PURE__ */ jsx("div", {
					className: "hidden md:block min-w-0",
					children: /* @__PURE__ */ jsx(ActivityTrack, {
						spans: track.spans,
						live: track.live,
						markers: track.markers,
						thin: child,
						label: runTitle(node)
					})
				}),
				/* @__PURE__ */ jsx(RowLink, {
					to: sessionRoute(node.slot),
					children: t("commandCenter.open_session")
				})
			]
		})
	});
}
/** A session's track: its turns from the usage store (read while the row is
*  drawn), the live run from the slot's own clock, and a dot at "now" when it
*  waits on a decision or failed. */
function SessionRow({ node, extras, timeline, drawn }) {
	const turns = useTurnHistory(node.slot, timeline.endMs, drawn);
	const markers = [];
	if (node.state === "needs_input") markers.push({
		atPct: 100,
		kind: "ask"
	});
	if (node.error || node.state === "blocked") markers.push({
		atPct: 100,
		kind: "error"
	});
	const track = {
		spans: turnSpans(turns.data ?? [], timeline),
		live: node.state === "running" && extras?.runningSinceMs != null ? spanOn(timeline, extras.runningSinceMs, timeline.endMs) : null,
		markers
	};
	return /* @__PURE__ */ jsx(BoardRow, {
		node,
		extras,
		timeline,
		track
	});
}
/** A subagent's track: a live span from its start to now while it runs. The
*  gateway records no end time for a finished run, so a finished row draws no
*  span (a bar to "now" would claim work that stopped long ago); a failed one
*  marks where it began, the one instant known. A workflow carries no clock and
*  draws only its state. */
function ChildRow({ node, agent, timeline }) {
	const startMs = agent?.started ? agent.started * 1e3 : void 0;
	const live = node.state === "running" && startMs !== void 0 ? spanOn(timeline, startMs, timeline.endMs) : null;
	const failedAt = !!node.error || node.state === "blocked" ? startMs === void 0 ? 100 : pointOn(timeline, startMs) ?? (startMs < timeline.startMs ? 0 : 100) : null;
	return /* @__PURE__ */ jsx(BoardRow, {
		node,
		timeline,
		track: {
			spans: [],
			live,
			markers: failedAt === null ? [] : [{
				atPct: failedAt,
				kind: "error"
			}]
		},
		child: true
	});
}
function groupBySession(nodes) {
	const groups = /* @__PURE__ */ new Map();
	for (const n of nodes) if (n.kind === "session") groups.set(n.slot, {
		session: n,
		children: []
	});
	for (const n of nodes) if (n.kind !== "session") groups.get(n.slot)?.children.push(n);
	return [...groups.values()];
}
function Axis({ timeline }) {
	const ticks = tickTimes(timeline, AXIS_TICKS);
	return /* @__PURE__ */ jsxs("div", {
		className: `hidden md:grid ${COLUMNS} text-[11px] text-muted pt-1`,
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ jsx("span", {}),
			/* @__PURE__ */ jsx("span", {}),
			/* @__PURE__ */ jsxs("div", {
				className: "relative h-4",
				children: [ticks.map((at, i) => /* @__PURE__ */ jsx("span", {
					className: "absolute -translate-x-1/2",
					style: { left: `${i / AXIS_TICKS * 100}%` },
					children: fmtTime(at)
				}, i)), /* @__PURE__ */ jsx("span", {
					className: "absolute right-0 font-medium text-text",
					children: t("pages.homePage.now")
				})]
			}),
			/* @__PURE__ */ jsx("span", {})
		]
	});
}
function FleetBoard({ nodes, attentionSlots, extras, subagents, ready, nowMs }) {
	const [hours, setHours] = useState(12);
	const [restingOpen, setRestingOpen] = useState(false);
	const timeline = timelineWindow(hours, nowMs);
	const agentById = new Map(subagents.map((a) => [a.id, a]));
	const { active, resting } = orderFleet(nodes, attentionSlots);
	const activeSlots = new Set(active.map((n) => n.slot));
	const activeGroups = groupBySession([...active, ...resting]).filter((g) => activeSlots.has(g.session.slot));
	const restingGroups = groupBySession(resting).filter((g) => !activeSlots.has(g.session.slot));
	const renderGroup = (g, drawn) => /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(SessionRow, {
		node: g.session,
		extras: extras.get(g.session.slot),
		timeline,
		drawn
	}), g.children.map((c) => /* @__PURE__ */ jsx(ChildRow, {
		node: c,
		agent: c.kind === "subagent" ? agentById.get(c.ref) : void 0,
		timeline
	}, c.id))] }, g.session.id);
	return /* @__PURE__ */ jsx(Section, {
		label: t("pages.homePage.fleet_title"),
		count: ready ? fmtNumber(activeGroups.length) : void 0,
		testId: "home-fleet",
		trailing: /* @__PURE__ */ jsx("div", {
			className: "flex items-center gap-1",
			role: "group",
			"aria-label": t("pages.homePage.window_label"),
			children: TIMELINE_HOURS.map((h) => /* @__PURE__ */ jsx(Btn, {
				primary: h === hours,
				"aria-pressed": h === hours,
				className: "px-2 py-0.5 text-[11px]",
				onClick: () => setHours(h),
				"data-testid": `home-window-${h}`,
				children: t("pages.homePage.window_hours", {
					count: h,
					amount: fmtNumber(h)
				})
			}, h))
		}),
		children: /* @__PURE__ */ jsxs(Card, {
			className: "py-1",
			children: [
				ready && !nodes.length && /* @__PURE__ */ jsx(EmptyState, {
					icon: /* @__PURE__ */ jsx(Radar, { size: 24 }),
					title: t("pages.sessionsPage.empty_title"),
					testId: "home-fleet-empty"
				}),
				activeGroups.length > 0 && /* @__PURE__ */ jsx("ul", {
					className: "list-none m-0 p-0",
					"data-testid": "home-fleet-active",
					children: activeGroups.map((g) => renderGroup(g, true))
				}),
				ready && !activeGroups.length && nodes.length > 0 && /* @__PURE__ */ jsx("p", {
					className: "text-sm text-muted py-2",
					children: t("pages.homePage.fleet_all_resting")
				}),
				nodes.length > 0 && /* @__PURE__ */ jsx(Axis, { timeline }),
				restingGroups.length > 0 && /* @__PURE__ */ jsxs("details", {
					className: "text-sm border-t border-border pt-2 mt-1",
					"data-testid": "home-fleet-resting",
					onToggle: (e) => setRestingOpen(e.currentTarget.open),
					children: [/* @__PURE__ */ jsx("summary", {
						className: "cursor-pointer text-muted",
						children: t("pages.homePage.fleet_resting", {
							count: restingGroups.length,
							amount: fmtNumber(restingGroups.length)
						})
					}), /* @__PURE__ */ jsx("ul", {
						className: "list-none m-0 p-0",
						children: restingGroups.map((g) => renderGroup(g, restingOpen))
					})]
				})
			]
		})
	});
}
// src/NeedsYou.tsx
/**
* The "Needs you" inbox: a card per session that waits on a person, each
* answerable from here and routed to the same gateway endpoints the dashboard's
* own cards use. Blockers come first (a question card, a tool approval, a
* session marked needs-input), then sessions whose newest reply offered next
* steps in an `[OPTIONS:]` line. Six cards show at first; "Show all" opens
* the rest.
*
* Nothing here sends on a click alone: a pick stays a draft until "Send answer",
* and an approval needs its own button. A label the dashboard would refuse to
* send bare (one that reads as a command) is withheld with a link to answer in
* the session.
*/
/** Cards shown at first: two rows of the widest grid. "Show all" opens the rest. */
var INITIAL_CARDS = 6;
function useLiveInvalidate() {
	const client = useQueryClient();
	return () => {
		for (const key of LIVE_KEYS) client.invalidateQueries({ queryKey: key });
	};
}
function errorLine(err, fallbackKey) {
	const status = err?.status;
	if (status === 404 || status === 409 || status === 410) return t("components.approvalCard.approval_no_longer_pending");
	const message = err instanceof Error ? err.message : "";
	return message ? t("components.approvalCard.decision_not_recorded_error", { error: message }) : t(fallbackKey);
}
/** The card's frame: its status badge (the same word and tint the board row
*  wears, or "Sent" once the answer has gone out), the session's title and the
*  link into it. */
function CardShell({ title, slot, status, children }) {
	return /* @__PURE__ */ jsxs(Card, {
		className: "space-y-3",
		"data-testid": "home-attention-card",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsx(Badge, {
					variant: status.variant,
					className: "shrink-0",
					"data-testid": "home-card-status",
					children: t(status.key)
				}), /* @__PURE__ */ jsx(RowLink, {
					to: sessionRoute(slot),
					children: t("commandCenter.open_session")
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "text-sm font-medium leading-snug",
				"data-testid": "home-card-title",
				children: title
			}),
			/* @__PURE__ */ jsx("p", {
				className: "text-[12px] text-muted m-0",
				children: t("commandCenter.explicit_input")
			}),
			children
		]
	});
}
/** One prompt's choices and a free-text line; the draft is the caller's. */
function Prompt({ prompt, value, onChange }) {
	const picks = new Set(value.split("\n").filter(Boolean));
	const toggle = (label) => {
		if (prompt.multiSelect) {
			const next = new Set(picks);
			if (next.has(label)) next.delete(label);
			else next.add(label);
			onChange([...next].join("\n"));
		} else onChange(picks.has(label) && picks.size === 1 ? "" : label);
	};
	const custom = [...picks].some((p) => !prompt.options.some((o) => o.label === p)) ? value : "";
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-lg bg-accent-subtle p-3 space-y-2",
		"data-testid": "home-question-prompt",
		children: [/* @__PURE__ */ jsx("div", {
			className: "text-sm font-medium",
			children: prompt.question
		}), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-2",
			children: [prompt.options.map((o) => /* @__PURE__ */ jsxs("button", {
				type: "button",
				"aria-pressed": picks.has(o.label),
				onClick: () => toggle(o.label),
				className: `text-left text-sm rounded-md border px-3 py-2 ${picks.has(o.label) ? "border-accent bg-accent/15" : "border-border bg-card"}`,
				children: [/* @__PURE__ */ jsx("div", { children: o.label }), o.description && /* @__PURE__ */ jsx("div", {
					className: "text-[12px] text-muted",
					children: o.description
				})]
			}, o.label)), /* @__PURE__ */ jsx("input", {
				type: "text",
				value: custom,
				onChange: (e) => onChange(e.target.value),
				placeholder: t("components.questionCard.or_type_a_custom_answer"),
				className: "text-sm rounded-md border border-border bg-card px-3 py-2 min-w-0",
				"aria-label": t("components.questionCard.or_type_a_custom_answer")
			})]
		})]
	});
}
function QuestionCard({ item, title }) {
	const [answers, setAnswers] = useState({});
	const refresh = useLiveInvalidate();
	const question = item.question;
	const mutation = useMutation({
		mutationFn: (payload) => writes.answer(question.ask_id, payload),
		onSuccess: refresh
	});
	const complete = question.questions.every((q) => (answers[q.question] ?? "").trim());
	if (!question.ask_id) return /* @__PURE__ */ jsxs(CardShell, {
		title,
		slot: item.slot,
		status: STATE.needs_input,
		children: [/* @__PURE__ */ jsx("div", {
			className: "text-sm",
			children: question.questions[0]?.question
		}), /* @__PURE__ */ jsx(RowLink, {
			to: sessionRoute(item.slot),
			children: t("pulse.answer_in_session")
		})]
	});
	return /* @__PURE__ */ jsxs(CardShell, {
		title,
		slot: item.slot,
		status: mutation.isSuccess ? SENT : STATE.needs_input,
		children: [
			question.questions.map((q) => /* @__PURE__ */ jsx(Prompt, {
				prompt: q,
				value: answers[q.question] ?? "",
				onChange: (next) => setAnswers((a) => ({
					...a,
					[q.question]: next
				}))
			}, q.question)),
			/* @__PURE__ */ jsx(ErrorNotice, { message: mutation.isError ? errorLine(mutation.error, "pulse.answer_failed") : void 0 }),
			/* @__PURE__ */ jsx("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ jsxs(Btn, {
					primary: true,
					disabled: !complete || mutation.isPending,
					onClick: () => mutation.mutate(Object.fromEntries(Object.entries(answers).map(([q, a]) => [q, a.trim()]))),
					"data-testid": "home-send-answer",
					children: [
						/* @__PURE__ */ jsx(MessageSquare, {
							size: 14,
							className: "lucide-inline"
						}),
						" ",
						t("commandCenter.send_answer")
					]
				})
			})
		]
	});
}
function ApprovalCard({ item, title, slot }) {
	const refresh = useLiveInvalidate();
	const target = approvalTarget(item.slot, item.approval, slot?.pending_approval_info);
	const tool = item.approval?.tool ?? slot?.pending_approval_info?.tool ?? "";
	const purpose = item.approval?.tool_purpose ?? slot?.pending_approval_info?.tool_purpose;
	const input = item.approval?.tool_input ?? slot?.pending_approval_info?.tool_input;
	const mutation = useMutation({
		mutationFn: (action) => writes.decide(target, action),
		onSuccess: refresh
	});
	return /* @__PURE__ */ jsxs(CardShell, {
		title,
		slot: item.slot,
		status: mutation.isSuccess ? SENT : STATE.needs_input,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "rounded-lg bg-warn-subtle p-3 space-y-1",
				"data-testid": "home-approval",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "text-sm font-medium",
						children: tool ? t("pulse.wants_to_run", { tool }) : t("pulse.approval_pending")
					}),
					purpose && /* @__PURE__ */ jsx("div", {
						className: "text-[12px] text-muted",
						children: purpose
					}),
					typeof input === "string" && input && /* @__PURE__ */ jsx("code", {
						className: "block text-[12px] break-all whitespace-pre-wrap",
						children: input
					})
				]
			}),
			/* @__PURE__ */ jsx(ErrorNotice, { message: mutation.isError ? errorLine(mutation.error, "components.approvalCard.decision_failed") : void 0 }),
			target ? /* @__PURE__ */ jsxs("div", {
				className: "flex justify-end gap-2",
				role: "group",
				"aria-label": t("commandCenter.attention_filter"),
				children: [/* @__PURE__ */ jsx(Btn, {
					disabled: mutation.isPending,
					onClick: () => mutation.mutate("reject_once"),
					title: t("commandCenter.reject_help"),
					"data-testid": "home-reject",
					children: t("commandCenter.reject")
				}), /* @__PURE__ */ jsx(Btn, {
					primary: true,
					disabled: mutation.isPending,
					onClick: () => mutation.mutate("approve"),
					"data-testid": "home-approve",
					children: t("commandCenter.approve")
				})]
			}) : /* @__PURE__ */ jsx(RowLink, {
				to: sessionRoute(item.slot),
				children: t("pulse.answer_in_session")
			})
		]
	});
}
function OpenSessionCard({ item, title, detail }) {
	return /* @__PURE__ */ jsxs(CardShell, {
		title,
		slot: item.slot,
		status: STATE.needs_input,
		children: [detail && /* @__PURE__ */ jsx("div", {
			className: "text-sm text-muted",
			children: detail
		}), /* @__PURE__ */ jsx(RowLink, {
			to: sessionRoute(item.slot),
			children: t("pulse.answer_in_session")
		})]
	});
}
/** A session whose newest reply offered next steps: pick one, or type a reply
*  of your own, and send it as the session's next message. A pick and typed
*  text are one answer, so choosing one clears the other. A command-shaped label
*  is withheld: sent bare it would run rather than say, so it is answered in the
*  session itself. */
function FollowUpCard({ item, title }) {
	const [pick, setPick] = useState("");
	const [typed, setTyped] = useState("");
	const refresh = useLiveInvalidate();
	const mutation = useMutation({
		mutationFn: (message) => writes.send(item.slot, message),
		onSuccess: refresh
	});
	const sendable = item.followUp.labels.filter((l) => !isCommandShaped(l));
	const withheld = item.followUp.labels.length - sendable.length;
	const answer = pick || typed.trim();
	return /* @__PURE__ */ jsxs(CardShell, {
		title,
		slot: item.slot,
		status: mutation.isSuccess ? SENT : STATE.waiting,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "rounded-lg bg-accent-subtle p-3 space-y-2",
				"data-testid": "home-follow-up",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "text-sm font-medium",
						children: t("commandCenter.options_question")
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid gap-2",
						children: [sendable.map((label) => /* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-pressed": pick === label,
							onClick: () => {
								setPick((p) => p === label ? "" : label);
								setTyped("");
							},
							className: `text-left text-sm rounded-md border px-3 py-2 ${pick === label ? "border-accent bg-accent/15" : "border-border bg-card"}`,
							children: label
						}, label)), /* @__PURE__ */ jsx("input", {
							type: "text",
							value: typed,
							onChange: (e) => {
								setTyped(e.target.value);
								setPick("");
							},
							placeholder: t("components.questionCard.or_type_a_custom_answer"),
							className: "text-sm rounded-md border border-border bg-card px-3 py-2 min-w-0",
							"aria-label": t("components.questionCard.or_type_a_custom_answer"),
							"data-testid": "home-follow-up-text"
						})]
					}),
					withheld > 0 && /* @__PURE__ */ jsx(RowLink, {
						to: sessionRoute(item.slot),
						children: t("pulse.answer_in_session")
					})
				]
			}),
			/* @__PURE__ */ jsx(ErrorNotice, { message: mutation.isError ? errorLine(mutation.error, "pulse.answer_failed") : void 0 }),
			/* @__PURE__ */ jsx("div", {
				className: "flex justify-end",
				children: /* @__PURE__ */ jsxs(Btn, {
					primary: true,
					disabled: !answer || mutation.isPending,
					onClick: () => mutation.mutate(answer),
					"data-testid": "home-follow-up-send",
					children: [
						/* @__PURE__ */ jsx(MessageSquare, {
							size: 14,
							className: "lucide-inline"
						}),
						" ",
						t("commandCenter.send_answer")
					]
				})
			})
		]
	});
}
function NeedsYou({ attention, sessions, slots, ready }) {
	const [visible, setVisible] = useState(INITIAL_CARDS);
	const title = (slot) => {
		const n = sessions.get(slot);
		return n ? n.title || slot : slot;
	};
	const items = [...attention.blockers, ...attention.followUps];
	const shown = items.slice(0, visible);
	const hidden = items.length - shown.length;
	return /* @__PURE__ */ jsxs(Section, {
		label: t("commandCenter.attention_filter"),
		count: fmtNumber(items.length),
		testId: "home-needs-you",
		children: [
			shown.length > 0 && /* @__PURE__ */ jsx("div", {
				className: "grid ch-cards gap-3 items-start",
				"data-testid": "home-needs-you-grid",
				children: shown.map((item) => {
					if (item.kind === "question") return /* @__PURE__ */ jsx(QuestionCard, {
						item,
						title: title(item.slot)
					}, item.id);
					if (item.kind === "approval") return /* @__PURE__ */ jsx(ApprovalCard, {
						item,
						title: title(item.slot),
						slot: slots.get(item.slot)
					}, item.id);
					if (item.kind === "follow_up") return /* @__PURE__ */ jsx(FollowUpCard, {
						item,
						title: title(item.slot)
					}, item.id);
					return /* @__PURE__ */ jsx(OpenSessionCard, {
						item,
						title: title(item.slot),
						detail: sessions.get(item.slot)?.detail
					}, item.id);
				})
			}),
			hidden > 0 && /* @__PURE__ */ jsx(Btn, {
				onClick: () => setVisible(items.length),
				"data-testid": "home-needs-you-more",
				children: t("pages.homePage.show_all", {
					count: hidden,
					amount: fmtNumber(hidden)
				})
			}),
			ready && !items.length && /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(EmptyState, {
				icon: /* @__PURE__ */ jsx(Inbox, { size: 24 }),
				title: t("commandCenter.no_input"),
				testId: "home-needs-you-empty"
			}) })
		]
	});
}
// src/Tile.tsx
function Tile({ label, value, detail, accent = false, colorClass, testId }) {
	return /* @__PURE__ */ jsxs(Card, {
		className: "min-w-0",
		"data-testid": testId,
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "text-muted text-[13px] font-medium uppercase tracking-[.04em]",
				"data-testid": "stat-card-label",
				children: label
			}),
			value === void 0 ? /* @__PURE__ */ jsx("div", {
				className: "skeleton h-7 w-16 mt-1.5 rounded",
				"data-testid": "stat-card-skeleton"
			}) : /* @__PURE__ */ jsx("div", {
				className: `text-2xl font-bold mt-1.5 tracking-tight leading-none ${accent ? "text-accent" : colorClass ?? ""}`,
				"data-testid": "stat-card-value",
				children: value
			}),
			detail && /* @__PURE__ */ jsx("div", {
				className: "text-[12px] text-muted mt-2 truncate",
				title: detail,
				"data-testid": "stat-card-detail",
				children: detail
			})
		]
	});
}
// src/SidePanels.tsx
/**
* The right column: where today's usage went (by model), the next jobs due,
* and the Bots roster. Each reads one gateway list and links to the dashboard
* page that owns it.
*/
/** Theme tints for the bar's segments, largest share first. */
var SEGMENT_CLASSES = [
	"bg-accent",
	"bg-accent/70",
	"ch-accent-45",
	"bg-accent/25",
	"bg-border-strong"
];
/** How many upcoming jobs the section lists; the Schedule page has the rest. */
var UPCOMING_LIMIT = 5;
function Spend({ models, usage, dollars }) {
	const rows = spendByModel(models, dollars, SEGMENT_CLASSES.length, t("pages.homePage.spend_other"));
	const total = rows.reduce((sum, r) => sum + r.amount, 0);
	const amount = (n) => dollars ? formatCost(n) : t("pages.overviewPage.today_tokens", {
		count: n,
		amount: fmtCompact(n)
	});
	const plan = usage?.billing;
	const percent = plan?.credits_plan ? (plan.credits_used ?? 0) / plan.credits_plan : void 0;
	return /* @__PURE__ */ jsx(Section, {
		label: t("pages.homePage.spend_title"),
		count: usage ? amount(total) : void 0,
		testId: "home-spend",
		trailing: /* @__PURE__ */ jsx(RowLink, {
			to: "/settings/overview?view=usage",
			children: t("pages.homePage.open_page")
		}),
		children: /* @__PURE__ */ jsxs(Card, {
			className: "space-y-3",
			children: [
				usage && !rows.length && /* @__PURE__ */ jsx(EmptyState, {
					icon: null,
					title: t("pages.homePage.spend_none"),
					testId: "home-spend-empty"
				}),
				rows.length > 0 && /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("div", {
					className: "flex h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated",
					role: "img",
					"aria-label": t("pages.homePage.spend_bar_label"),
					"data-testid": "home-spend-bar",
					children: rows.map((r, i) => /* @__PURE__ */ jsx("span", {
						className: SEGMENT_CLASSES[i],
						style: { width: `${r.amount / total * 100}%` },
						"data-testid": "home-spend-segment"
					}, r.model))
				}), /* @__PURE__ */ jsx("ul", {
					className: "list-none m-0 p-0 space-y-1.5",
					children: rows.map((r, i) => /* @__PURE__ */ jsxs("li", {
						className: "flex items-center gap-2 min-w-0 text-[13px]",
						"data-testid": "home-spend-row",
						children: [
							/* @__PURE__ */ jsx("span", { className: `w-2 h-2 rounded-full shrink-0 ${SEGMENT_CLASSES[i]}` }),
							/* @__PURE__ */ jsx("span", {
								className: "flex-1 min-w-0 truncate",
								children: r.model
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-muted tabular-nums shrink-0",
								children: fmtPercentFloor(r.amount / total)
							}),
							/* @__PURE__ */ jsx("span", {
								className: "tabular-nums shrink-0 w-20 text-right",
								children: amount(r.amount)
							})
						]
					}, r.model))
				})] }),
				plan?.plan && percent !== void 0 && /* @__PURE__ */ jsx("div", {
					className: "text-[12px] text-muted",
					children: t("pages.homePage.spend_plan", {
						plan: plan.plan,
						percent: fmtPercentFloor(percent),
						amount: fmtNumber(Math.floor(percent * 100))
					})
				})
			]
		})
	});
}
/** `jobs` is undefined while the list loads or when its read failed; the page's
*  own notice says so, and this card stays quiet rather than saying it twice. */
function Schedule({ jobs }) {
	const upcoming = jobs ? upcomingJobs(jobs, UPCOMING_LIMIT) : [];
	return /* @__PURE__ */ jsx(Section, {
		label: t("pages.homePage.upcoming"),
		count: jobs ? fmtNumber(upcoming.length) : void 0,
		testId: "home-schedule",
		trailing: /* @__PURE__ */ jsx(RowLink, {
			to: "/schedule",
			children: t("pages.homePage.open_page")
		}),
		children: /* @__PURE__ */ jsxs(Card, {
			className: "py-1",
			children: [jobs && !upcoming.length && /* @__PURE__ */ jsx(EmptyState, {
				icon: /* @__PURE__ */ jsx(CalendarDays, { size: 24 }),
				title: t("pages.homePage.no_next_run"),
				testId: "home-schedule-empty"
			}), upcoming.length > 0 && /* @__PURE__ */ jsx("ul", {
				className: "list-none m-0 p-0",
				children: upcoming.map((job) => /* @__PURE__ */ jsxs(ListRow, {
					"data-testid": "home-schedule-row",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex-1 min-w-0",
							children: [/* @__PURE__ */ jsx("div", {
								className: "text-sm font-medium truncate",
								children: job.name
							}), /* @__PURE__ */ jsx("div", {
								className: "text-[12px] text-muted truncate",
								children: t("pages.homePage.due", { when: fmtRelative(job.next_run_ts * 1e3) })
							})]
						}),
						job.is_running ? /* @__PURE__ */ jsx(Badge, {
							variant: "ok",
							children: t("pages.schedulePage.running")
						}) : job.last_status === "error" ? /* @__PURE__ */ jsx(Badge, {
							variant: "err",
							children: t("pages.schedulePage.error")
						}) : null,
						/* @__PURE__ */ jsx(RowLink, {
							to: `/schedule?job=${encodeURIComponent(job.id)}`,
							children: t("pages.homePage.open")
						})
					]
				}, job.id))
			})]
		})
	});
}
function Bots({ rows, error }) {
	const counts = botCounts(rows ?? []);
	const ordered = [...rows ?? []].sort((a, b) => Number(b.running) - Number(a.running) || (b.last_active_ts ?? 0) - (a.last_active_ts ?? 0));
	return /* @__PURE__ */ jsx(Section, {
		label: t("nav.crew_members"),
		count: rows ? t("pages.homePage.bots_count", {
			running: fmtNumber(counts.running),
			total: fmtNumber(counts.total)
		}) : void 0,
		testId: "home-bots",
		trailing: /* @__PURE__ */ jsx(RowLink, {
			to: "/members",
			children: t("pages.homePage.open_page")
		}),
		children: /* @__PURE__ */ jsxs(Card, {
			className: "py-1",
			children: [
				/* @__PURE__ */ jsx(ErrorNotice, { message: error ? t("pages.homePage.bots_unavailable") : void 0 }),
				rows && !rows.length && /* @__PURE__ */ jsx(EmptyState, {
					icon: /* @__PURE__ */ jsx(Bot, { size: 24 }),
					title: t("pages.membersPage.empty_title"),
					testId: "home-bots-empty"
				}),
				ordered.length > 0 && /* @__PURE__ */ jsx("ul", {
					className: "list-none m-0 p-0",
					children: ordered.map((row) => /* @__PURE__ */ jsxs(ListRow, {
						"data-testid": "home-bot-row",
						"data-running": row.running ? "true" : "false",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: `w-7 h-7 rounded-full shrink-0 grid place-items-center text-[12px] font-semibold ${row.running ? "bg-accent text-accent-fg" : "bg-bg-elevated text-muted"}`,
								"aria-hidden": "true",
								children: (row.display_name ?? row.name).slice(0, 1).toUpperCase()
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex-1 min-w-0",
								children: [/* @__PURE__ */ jsx("div", {
									className: "text-sm font-medium truncate",
									children: row.display_name ?? row.name
								}), row.last_active_ts != null && /* @__PURE__ */ jsx("div", {
									className: "text-[12px] text-muted truncate",
									children: t("pages.homePage.last_active", { when: fmtRelative(row.last_active_ts * 1e3) })
								})]
							}),
							/* @__PURE__ */ jsx(Badge, {
								variant: row.running ? "aim" : "muted",
								className: "shrink-0",
								children: t(row.running ? "commandCenter.running" : "commandCenter.idle")
							}),
							/* @__PURE__ */ jsx(RowLink, {
								to: `/members?member=${encodeURIComponent(row.name)}`,
								children: t("pages.homePage.open")
							})
						]
					}, row.slug))
				})
			]
		})
	});
}
// src/PulsePage.tsx
/**
* Pulse: mission control for the crew on one page. What is running, what is
* waiting on a person, what is scheduled, and what today has cost, each read
* from the gateway list the dashboard page for it reads, so Home cannot
* disagree with the page it links to.
*
* Layout: a stat strip, then the agent board with the Needs-you inbox under it
* on the left; today's spend, the upcoming jobs and the Bots on the right.
*/
var EMPTY = [];
/** The Today line: sessions and messages, then tokens and cost when known. */
function todayLine(sessions, messages, tokens, cost) {
	const count = (n) => ({
		count: compactPluralCount(n ?? 0),
		amount: fmtCompact(n ?? NaN)
	});
	const parts = [t("pages.overviewPage.today_sessions", count(sessions)), t("pages.overviewPage.today_messages", count(messages))];
	if (tokens !== void 0) parts.push(t("pages.overviewPage.today_tokens", count(tokens)));
	if (cost !== void 0) parts.push(formatCost(cost));
	return t("pages.overviewPage.today_line", { summary: parts.join(" · ") });
}
function uptimeLine(startSec, version, nowMs) {
	const uptime = startSec ? fmtElapsedMinutes(startSec * 1e3, nowMs) : "—";
	return version ? t("pages.overviewPage.uptime_line_version", {
		uptime,
		version
	}) : t("pages.overviewPage.uptime_line", { uptime });
}
function PulsePage() {
	useFleetRefresh();
	const nowMs = useMinuteClock();
	const slots = useQuery(slotsQuery);
	const questions = useQuery(questionsQuery);
	const approvals = useQuery(approvalsQuery);
	const subagents = useQuery(subagentsQuery);
	const workflows = useQuery(workflowsQuery);
	const crons = useQuery(cronsQuery);
	const members = useQuery(membersQuery);
	const usage = useQuery(usageQuery);
	const status = useQuery(statusQuery);
	const config = useQuery(configQuery);
	const fleet = useMemo(() => buildFleet({
		slots: slots.data ?? EMPTY,
		questions: questions.data ?? EMPTY,
		approvals: approvals.data ?? EMPTY,
		subagents: subagents.data ?? EMPTY,
		workflows: workflows.data ?? EMPTY
	}, nowMs), [
		slots.data,
		questions.data,
		approvals.data,
		subagents.data,
		workflows.data,
		nowMs
	]);
	const attention = useMemo(() => splitAttention(fleet.attention), [fleet.attention]);
	const sessions = useMemo(() => new Map(fleet.nodes.filter((n) => n.kind === "session").map((n) => [n.slot, n])), [fleet.nodes]);
	const slotByKey = useMemo(() => new Map((slots.data ?? EMPTY).map((s) => [s.key, s])), [slots.data]);
	const extras = useMemo(() => new Map((slots.data ?? EMPTY).map((s) => [s.key, rowExtras(s)])), [slots.data]);
	const attentionSlots = useMemo(() => new Set(attention.blockers.map((a) => a.slot)), [attention.blockers]);
	const ready = slots.isSuccess && questions.isFetched && approvals.isFetched;
	const active = activeCounts(fleet.nodes);
	const activeDetail = fmtList([
		t("pages.overviewPage.today_sessions", {
			count: active.sessions,
			amount: fmtNumber(active.sessions)
		}),
		t("pages.homePage.subagents", {
			count: active.subagents,
			amount: fmtNumber(active.subagents)
		}),
		t("pages.homePage.workflows", {
			count: active.workflows,
			amount: fmtNumber(active.workflows)
		})
	]);
	const waiting = attention.blockers.length + attention.followUps.length;
	const attentionDetail = !waiting ? t("commandCenter.no_input") : [attention.blockers.length ? fmtList([t("pages.homePage.questions_count", {
		count: attention.questions,
		amount: fmtNumber(attention.questions)
	}), t("pages.homePage.approvals_count", {
		count: attention.approvals,
		amount: fmtNumber(attention.approvals)
	})]) : "", attention.followUps.length ? t("pages.homePage.suggestions_count", {
		count: attention.followUps.length,
		amount: fmtNumber(attention.followUps.length)
	}) : ""].filter(Boolean).join(" · ");
	const schedule = crons.data ? scheduleSummary(crons.data) : void 0;
	const scheduleDetail = schedule && [
		schedule.next ? t("pages.homePage.next_run", {
			name: schedule.next.name,
			when: fmtRelative(schedule.next.next_run_ts * 1e3)
		}) : t("pages.homePage.no_next_run"),
		schedule.failing ? t("pages.homePage.failing_count", {
			count: schedule.failing,
			amount: fmtNumber(schedule.failing)
		}) : "",
		schedule.paused ? t("pages.homePage.paused_count", {
			count: schedule.paused,
			amount: fmtNumber(schedule.paused)
		}) : ""
	].filter(Boolean).join(" · ");
	const dollars = reportsDollars(config.data?.agent?.acp_backend);
	const report = usage.data;
	const todayBucket = report?.local_day ? report.tokens?.daily_history?.find((d) => d.date === report.local_day) : void 0;
	const todayTokens = dollars && todayBucket ? tokensOf({
		input: todayBucket.input,
		output: todayBucket.output,
		cache_create: todayBucket.cache_creation,
		cache_read: todayBucket.cache_read
	}) : void 0;
	const todayCost = dollars ? todayBucket?.cost_usd : void 0;
	const todayValue = usage.isError ? "—" : !report || config.isPending ? void 0 : dollars ? formatCost(todayCost ?? 0) : fmtCompact(report.sessions?.today?.sessions ?? 0);
	const todayDetail = report ? todayLine(report.sessions?.today?.sessions, report.sessions?.today?.messages, todayTokens, todayCost) : void 0;
	const sourceError = slots.isError ? t("pulse.sessions_unavailable") : questions.isError || approvals.isError || subagents.isError || workflows.isError ? t("commandCenter.stale") : void 0;
	const connected = status.isSuccess;
	return /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(PageHeader, {
		title: t("pulse.title"),
		subtitle: t("pages.homePage.subtitle")
	}), /* @__PURE__ */ jsxs("div", {
		className: "px-4 md:px-6 pb-8 overflow-y-auto flex-1 min-h-0 space-y-4",
		children: [
			/* @__PURE__ */ jsx(ErrorNotice, { message: sourceError }),
			/* @__PURE__ */ jsx(ErrorNotice, { message: crons.isError ? t("pages.homePage.schedule_unavailable") : void 0 }),
			/* @__PURE__ */ jsxs("div", {
				className: "grid ch-tiles gap-3",
				"data-testid": "home-stat-strip",
				children: [
					/* @__PURE__ */ jsx(Tile, {
						testId: "home-stat-active",
						label: t("pages.homePage.active_now"),
						value: ready ? fmtNumber(active.total) : void 0,
						detail: activeDetail,
						accent: active.total > 0
					}),
					/* @__PURE__ */ jsx(Tile, {
						testId: "home-stat-attention",
						label: t("commandCenter.attention_filter"),
						value: ready ? fmtNumber(waiting) : void 0,
						detail: attentionDetail,
						colorClass: waiting ? "text-warn-text" : void 0
					}),
					/* @__PURE__ */ jsx(Tile, {
						testId: "home-stat-schedule",
						label: t("pages.homePage.scheduled"),
						value: schedule ? fmtNumber(schedule.enabled) : crons.isError ? "—" : void 0,
						detail: scheduleDetail,
						colorClass: schedule?.failing ? "text-danger-text" : void 0
					}),
					/* @__PURE__ */ jsx(Tile, {
						testId: "home-stat-today",
						label: t("pages.homePage.today"),
						value: todayValue,
						detail: todayDetail
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid ch-page-cols gap-4 items-start",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "space-y-4 min-w-0",
					children: [/* @__PURE__ */ jsx(FleetBoard, {
						nodes: fleet.nodes,
						attentionSlots,
						extras,
						subagents: subagents.data ?? EMPTY,
						ready,
						nowMs
					}), /* @__PURE__ */ jsx(NeedsYou, {
						attention,
						sessions,
						slots: slotByKey,
						ready
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "space-y-4 min-w-0",
					children: [
						/* @__PURE__ */ jsx(Spend, {
							models: todayBucket?.models,
							usage: report,
							dollars
						}),
						/* @__PURE__ */ jsx(Schedule, { jobs: crons.data }),
						/* @__PURE__ */ jsx(Bots, {
							rows: members.data,
							error: members.isError
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("footer", {
				className: "flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted",
					"data-testid": "gateway-health-line",
					children: [
						/* @__PURE__ */ jsx("span", { className: `w-2 h-2 rounded-full shrink-0 ${connected ? "bg-ok" : "bg-warn"}` }),
						/* @__PURE__ */ jsx("span", {
							className: "text-text font-medium",
							children: connected ? t("pages.overviewPage.all_systems_running") : status.isError ? t("pulse.gateway_unreachable") : t("pages.overviewPage.connecting")
						}),
						connected && /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							children: "·"
						}), /* @__PURE__ */ jsx("span", { children: uptimeLine(status.data?.start_time, status.data?.version, nowMs) })] })
					]
				}), /* @__PURE__ */ jsx(RowLink, {
					to: "/settings/overview",
					children: t("pages.homePage.open_overview")
				})]
			})
		]
	})] });
}
// src/styles.ts
/**
* The few rules the dashboard's stylesheet cannot be relied on for.
*
* The page is styled with the dashboard's own utility classes, which the
* dashboard compiles only for the class names ITS sources use. An arbitrary
* grid template or a tint the dashboard happens not to use would have no CSS at
* runtime, and a dashboard release could drop one the page relied on. So the
* page's own grid shapes (the stat strip, the two-column page, the board) and tints live here, under `ch-` names, painted from
* the theme's variables so they follow every theme. Injected once per document.
*/
var STYLE_ID = "crew-pulse-styles";
var CSS = `
.ch-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (min-width: 768px) { .ch-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.ch-page-cols { grid-template-columns: minmax(0, 1fr); }
@media (min-width: 1280px) { .ch-page-cols { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); } }
.ch-cards { grid-template-columns: minmax(0, 1fr); }
@media (min-width: 768px) { .ch-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (min-width: 1280px) { .ch-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.ch-board-cols { grid-template-columns: auto minmax(0, 1fr) auto; }
@media (min-width: 768px) { .ch-board-cols { grid-template-columns: auto minmax(0, 5fr) minmax(0, 4fr) auto; } }
.ch-accent-50 { background-color: color-mix(in srgb, var(--accent) 50%, transparent); }
.ch-accent-45 { background-color: color-mix(in srgb, var(--accent) 45%, transparent); }
`;
function ensureStyles(doc = document) {
	if (doc.getElementById(STYLE_ID)) return;
	const style = doc.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	doc.head.appendChild(style);
}
// src/index.tsx
/**
* The bundle's entry: the dashboard lazy-imports this module and renders its
* default export as the app's page.
*
* Subscribing to the host's language generation here is what repaints the page
* on a language switch: `t` reads the active locale at call time, and this
* component's re-render reaches every child. The host's scoped API client is
* bound here too, before the page's first request. The host mounts the page
* inside a React Query client of the app's own.
*/
function PulseApp() {
	useLanguageGeneration();
	bindAppApi(useAppApi());
	useEffect(() => ensureStyles(), []);
	return /* @__PURE__ */ jsx(PulsePage, {});
}
export { PulseApp as default };
