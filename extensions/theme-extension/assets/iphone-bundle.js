(() => {
  "use strict";

  /* ===============================
     CONFIG
  =============================== */

  const container = document.getElementById("iphone-bundle");
  if (!container) return;

  const IPHONE_ID = Number(container.dataset.iphoneVariantId);
  const CHARGER_ID = Number(container.dataset.chargerVariantId);
  const BUNDLE_NAME = container.dataset.bundleName || "iPhone Bundle";

  if (!IPHONE_ID || !CHARGER_ID) {
    console.error(`${BUNDLE_NAME}: Missing variant IDs`);
    return;
  }

  let isUpdating = false;
  let lastCartHash = null;

  /* ===============================
     CART HELPERS
  =============================== */

  async function getCart() {
    const res = await fetch("/cart.js");
    if (!res.ok) throw new Error("Failed to fetch cart");
    return res.json();
  }

  async function updateCart(updates) {
    isUpdating = true;
    try {
      const res = await fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      // Trigger cart refresh events
      document.dispatchEvent(new Event("cart:refresh"));

      return res.json();
    } finally {
      setTimeout(() => {
        isUpdating = false;
      }, 500); // Delay to prevent rapid successive calls
    }
  }

  function cartChanged(cart) {
    const hash = cart.items
      .map((i) => `${i.variant_id}:${i.quantity}`)
      .sort()
      .join("|");

    if (hash === lastCartHash) return false;
    lastCartHash = hash;
    return true;
  }

  /* ===============================
     CORE LOGIC
  =============================== */

  async function syncBundle() {
    if (isUpdating) {
      setTimeout(syncBundle, 300);
      return;
    }

    const cart = await getCart();
    if (!cartChanged(cart)) return;

    const iphoneItems = cart.items.filter((i) => i.variant_id === IPHONE_ID);
    const iphoneQty = iphoneItems.reduce((sum, i) => sum + i.quantity, 0);

    const chargerItems = cart.items.filter((i) => i.variant_id === CHARGER_ID);
    const chargerQty = chargerItems.reduce((sum, i) => sum + i.quantity, 0);

    console.log(
      `${BUNDLE_NAME}: iPhone qty: ${iphoneQty}, Charger qty: ${chargerQty}`,
    );

    /* 1️⃣ iPhone removed → remove charger */
    if (iphoneQty === 0 && chargerQty > 0) {
      console.log(`${BUNDLE_NAME}: Removing charger since iPhone removed`);
      await updateCart({ [CHARGER_ID]: 0 });
      return;
    }

    /* 2️⃣ iPhone exists → sync charger */
    if (iphoneQty > 0 && chargerQty !== iphoneQty) {
      console.log(
        `${BUNDLE_NAME}: Updating charger quantity from ${chargerQty} to ${iphoneQty}`,
      );
      await updateCart({ [CHARGER_ID]: iphoneQty });
      return;
    }
  }

  /* ===============================
     LISTENERS
  =============================== */

  function debounce(fn, delay = 150) {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(fn, delay);
    };
  }

  const debouncedSync = debounce(syncBundle);

  document.addEventListener("DOMContentLoaded", syncBundle);
  document.addEventListener("cart:change", debouncedSync);
  document.addEventListener("cart:updated", debouncedSync);
  document.addEventListener("cart:added", debouncedSync);
})();
