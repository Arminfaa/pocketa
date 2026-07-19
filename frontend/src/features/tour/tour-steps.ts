import { getHelpTopic } from "./tour-content";

export type TourShell = "mobile" | "desktop";

export type TourStep = {
  id: string;
  /** References HELP_TOPICS id for title/body */
  topicId: string;
  /** `data-tour` attribute value to spotlight; omit for centered card */
  target?: string;
  /** Navigate here before showing the step */
  route?: string;
  /** Open a mobile action sheet before measuring the target */
  sheet?: "more" | "add" | null;
};

function step(
  topicId: string,
  extras: Partial<Omit<TourStep, "topicId">> = {}
): TourStep {
  return { id: topicId, topicId, sheet: null, ...extras };
}

/** Interactive tour sequence — branches by shell (screen width). */
export function getTourSteps(shell: TourShell): TourStep[] {
  if (shell === "mobile") {
    return [
      step("welcome"),
      step("account-filter", { target: "account-filter" }),
      step("theme", { target: "theme-toggle" }),
      step("dashboard", { target: "nav-home", route: "/dashboard" }),
      step("transactions", { target: "nav-transactions", route: "/transactions" }),
      step("add", { target: "nav-add", sheet: null }),
      step("add", {
        id: "add-sheet",
        target: "add-sheet",
        sheet: "add",
      }),
      step("reports", { target: "nav-reports", route: "/reports" }),
      step("more", { target: "nav-more" }),
      step("more", {
        id: "more-sheet",
        target: "more-sheet",
        sheet: "more",
      }),
      step("imports", { route: "/imports/bank-sms" }),
      step("review", { route: "/review" }),
      step("recurring", { route: "/recurring" }),
      step("investments", { route: "/investments" }),
      step("goals", { route: "/goals" }),
      step("accounts", { route: "/accounts" }),
      step("categories", { route: "/categories" }),
      step("budgets", { route: "/budgets" }),
      step("settings", { route: "/settings" }),
      step("help", { route: "/help" }),
    ];
  }

  return [
    step("welcome"),
    step("sidebar", { target: "sidebar" }),
    step("account-filter", { target: "account-filter" }),
    step("theme", { target: "theme-toggle" }),
    step("dashboard", { target: "nav-dashboard", route: "/dashboard" }),
    step("transactions", { target: "nav-transactions", route: "/transactions" }),
    step("imports", { target: "nav-imports", route: "/imports/bank-sms" }),
    step("review", { target: "nav-review", route: "/review" }),
    step("recurring", { target: "nav-recurring", route: "/recurring" }),
    step("investments", { target: "nav-investments", route: "/investments" }),
    step("goals", { target: "nav-goals", route: "/goals" }),
    step("accounts", { target: "nav-accounts", route: "/accounts" }),
    step("categories", { target: "nav-categories", route: "/categories" }),
    step("budgets", { target: "nav-budgets", route: "/budgets" }),
    step("reports", { target: "nav-reports", route: "/reports" }),
    step("settings", { target: "nav-settings", route: "/settings" }),
    step("help", { target: "nav-help", route: "/help" }),
  ];
}

export function getStepCopy(stepDef: TourStep): { title: string; body: string } {
  const topic = getHelpTopic(stepDef.topicId);
  const title = topic?.title ?? stepDef.topicId;
  const paragraphs = topic?.body ?? [];
  // Tour card stays short — first two paragraphs
  const body = paragraphs.slice(0, 2).join(" ");
  return { title, body };
}
