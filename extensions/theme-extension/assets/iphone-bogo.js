(function () {
  const IPHONE_ID = 47535108292828;
  const CHARGER_ID = 47535108948188;

  // lock the loop when we are applying changes to cart to avoid infinite loop of updates when we are adding or removing the charger and also w
  let cartLocked = false;
  // keep the last cart state to avoid unnecessary updates when cart is not changed
  let lastCartData = "";

  
  function getCart() {
    return fetch("/cart.js").then((r) => r.json());
  }


  function addCharger(qty) {
    return fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: CHARGER_ID, quantity: qty }), 
    }).then((r) => r.json());
  }

  function removeCharger(lineKey) {
    return fetch("/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lineKey, quantity: 0 }),
    }).then((r) => r.json());
  }

  function syncChargerQty(lineKey, qty) {
    return fetch("/cart/change.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lineKey, quantity: qty }),
    }).then((r) => r.json());
  }

  function refreshCart() {
    document.dispatchEvent(
      new CustomEvent("cart:update", {
        bubbles: true,
        detail: { data: { itemCount: 1, source: "bogo-refresh" } },
      }),
    );
  }

  async function checkCart() {
    if (cartLocked) return;

    try {

      // if cart is not changed then do nothing only watch if the cart is changing or not 

      const cart = await getCart();
      const cartJson = JSON.stringify(cart.items);

      if (cartJson === lastCartData) return;
      lastCartData = cartJson;

      // finding the iphone and charger line items in the cart (if any)
      const iphoneItems = cart.items.filter((i) => i.variant_id === IPHONE_ID);
      const chargerItems = cart.items.filter((i) => i.variant_id === CHARGER_ID);

      // checking how much iphone is there in cart
      const iphoneQty = iphoneItems.reduce((sum, i) => sum + i.quantity, 0);

      // Keep only the first charger line item; remove any extras.
      // (Shopify can also split charger lines when discounts are applied.)
      const chargerItem = chargerItems[0] || null;
      const chargerQty  = chargerItem ? chargerItem.quantity : 0;

      // Remove duplicate charger line items before doing anything else.
      if (chargerItems.length > 1) {
        cartLocked = true;
        for (let i = 1; i < chargerItems.length; i++) {
          await removeCharger(chargerItems[i].key);
        }
        refreshCart();
        return; // Let the next interval tick re-evaluate with the cleaned-up cart.
      }

      console.log("[BOGO] iPhone total qty:", iphoneQty, "| Charger qty:", chargerQty);

      cartLocked = true;

      if (iphoneQty > 0 && !chargerItem) {
        // No charger in cart yet — add one matching total iPhone qty.
        console.log("[BOGO] adding charger qty:", iphoneQty);
        await addCharger(iphoneQty);
        refreshCart();
      } else if (iphoneQty === 0 && chargerItem) {
        // All iPhones removed — remove the charger too.
        console.log("[BOGO] removing charger (no iPhones left)");
        await removeCharger(chargerItem.key);
        refreshCart();
      } else if (iphoneQty > 0 && chargerItem && chargerQty !== iphoneQty) {
        // iPhone qty changed — sync charger to match.
        console.log("[BOGO] syncing charger qty to:", iphoneQty);
        await syncChargerQty(chargerItem.key, iphoneQty);
        refreshCart();
      }

    } catch (err) {
      console.error("[BOGO] error:", err);
    } finally {
      setTimeout(() => {
        cartLocked = false;
      }, 1000);
    }
  }

  setInterval(checkCart, 1000);
  document.addEventListener("DOMContentLoaded", checkCart);
})();