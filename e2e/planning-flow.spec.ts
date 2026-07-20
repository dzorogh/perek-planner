import { expect, test } from "@playwright/test";

const email =
  process.env.E2E_OPERATOR_EMAIL?.trim() ||
  process.env.SMOKE_OPERATOR_EMAIL?.trim() ||
  "";
const password =
  process.env.E2E_OPERATOR_PASSWORD?.trim() ||
  process.env.SMOKE_OPERATOR_PASSWORD?.trim() ||
  "";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/auth/login");
  await page.getByLabel("Эл. почта").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL(/\/history/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "История" })).toBeVisible();
}

test.describe("Planning happy path (authenticated)", () => {
  test.beforeAll(() => {
    test.skip(
      !email || !password,
      "Set E2E_OPERATOR_EMAIL/PASSWORD or SMOKE_OPERATOR_* in .env.local",
    );
    test.skip(
      !process.env.OPENROUTER_API_KEY?.trim(),
      "OPENROUTER_API_KEY required for menu generation",
    );
  });

  test("generate → menu → shopping list → history", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page);

    await page.getByRole("button", { name: "Создать меню", exact: true }).click();
    const createDialog = page.locator('[data-component="create-menu-dialog"]');
    await expect(createDialog).toBeVisible();
    await createDialog.getByRole("radio", { name: "1 день" }).click();
    await createDialog.getByRole("radio", { name: "2 чел." }).click();
    await createDialog.getByRole("button", { name: "Сгенерировать" }).click();

    await expect(page).toHaveURL(/\/plan\/menu\?menuId=/, { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "Меню" })).toBeVisible();
    await expect(page.getByText("День 1")).toBeVisible();

    // Generated snack slot (meal-lane + overflow actions)
    await expect(page.getByText("Перекус", { exact: true }).first()).toBeVisible();
    const snackSlot = page.locator('[data-component="snack-slot"]').first();
    await expect(snackSlot).toBeVisible();
    await expect(snackSlot).toHaveAttribute("data-empty", "false");
    await snackSlot.getByRole("button", { name: "Действия со слотом" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Заменить" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Никогда не предлагать" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // Recipe text dialog
    const recipeTrigger = page
      .locator('[data-component="recipe-text-trigger"]')
      .first();
    await recipeTrigger.click();
    await expect(
      page.locator('[data-component="recipe-text-panel"]'),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.locator('[data-component="recipe-text-panel"]'),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "К списку покупок →" }).click();
    await expect(page).toHaveURL(/\/plan\/shopping-list\?menuId=/, {
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "Список покупок" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Копировать список" }),
    ).toBeVisible();

    const quantity = page
      .getByText(/\d{1,6} г/)
      .or(page.getByText(/\d{1,6} мл/))
      .or(page.getByText(/\d{1,6} шт/))
      .first();
    await expect(quantity).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Перекусы" })).toBeVisible();

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Копировать список" }).click();
    await expect(page.getByText("Список скопирован.")).toBeVisible();

    await page.getByRole("link", { name: "История" }).click();
    await expect(page.getByRole("heading", { name: "История" })).toBeVisible();
    await expect(
      page.locator('[data-component="history-rating-row"]').first(),
    ).toBeVisible();

    await page.getByRole("link", { name: "Настройки" }).click();
    await expect(page.getByRole("heading", { name: "Настройки" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти" }).nth(1)).toBeVisible();
  });
});
