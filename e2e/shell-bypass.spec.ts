import { expect, test } from "@playwright/test";

/**
 * Soft Workshop shell under KEPLO_DEV_BYPASS_AUTH (middleware skips login redirect).
 * Does not require a session — covers navigation / empty states.
 */
test.describe("App shell (bypass auth)", () => {
  test("W1 chrome: brand, CTA modal, wizard on plan; hidden off-plan", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/history/);
    await expect(page.getByRole("heading", { name: "История" })).toBeVisible();

    await expect(
      page.getByRole("link", { name: "Keplo — на главную" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Создать меню", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Шаги планирования" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Создать меню", exact: true }).click();
    const createDialog = page.locator('[data-component="create-menu-dialog"]');
    await expect(createDialog).toBeVisible();
    await expect(
      createDialog.getByRole("heading", { name: "Новое меню" }),
    ).toBeVisible();
    await expect(
      createDialog.getByRole("button", { name: "Сгенерировать" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(createDialog).toHaveCount(0);

    await page.goto("/plan/menu");
    await expect(page.getByRole("heading", { name: "Меню" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Создать меню" }),
    ).toBeVisible();
    const wizard = page.getByRole("navigation", { name: "Шаги планирования" });
    await expect(wizard).toBeVisible();
    await expect(
      wizard.getByRole("link", { name: "Новое меню" }),
    ).toHaveCount(0);
    await expect(
      wizard.getByRole("link", { name: "Состав", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("План", { exact: true })).toHaveCount(0);

    // Legacy portions URL redirects home when no menuId
    await page.goto("/plan/portions");
    await expect(page).toHaveURL(/\/history/);
    await expect(
      page.getByRole("navigation", { name: "Шаги планирования" }),
    ).toHaveCount(0);

    await page.goto("/plan/shopping-list");
    await expect(page.getByRole("heading", { name: "Список покупок" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Шаги планирования" }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "История", exact: true })
      .click();
    await expect(page).toHaveURL(/\/history/);
    await expect(page.getByRole("heading", { name: "История" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Шаги планирования" }),
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("navigation", { name: "Основная навигация" })
        .getByRole("link", { name: "История", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    await page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("link", { name: "Настройки", exact: true })
      .click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Шаги планирования" }),
    ).toHaveCount(0);

    await page.goto("/auth/login");
    await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
  });
});
