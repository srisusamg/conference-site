function createCategoryChip(label) {
  const chip = document.createElement("span");
  chip.className = "vendor-chip";
  chip.textContent = label;
  return chip;
}

export function renderVendors(container, vendors) {
  container.innerHTML = "";

  if (!vendors.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No vendors match your filters yet.";
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  vendors.forEach((vendor) => {
    const card = document.createElement("article");
    card.className = "vendor-card";

    const title = document.createElement("h2");
    title.className = "vendor-name";
    title.textContent = vendor.name || "Vendor";

    const booth = document.createElement("p");
    booth.className = "vendor-booth";
    booth.textContent = `Booth ${vendor.booth || "TBA"}`;

    const deal = document.createElement("p");
    deal.className = "vendor-deal";
    deal.textContent = vendor.deal || "Ask about conference specials.";

    const categories = document.createElement("div");
    categories.className = "vendor-categories";
    (vendor.categories || []).forEach((category) => {
      categories.appendChild(createCategoryChip(category));
    });

    const contact = document.createElement("a");
    contact.className = "vendor-contact";
    contact.textContent = "Contact vendor";
    contact.href = `mailto:${vendor.email || "info@example.com"}`;

    card.append(title, booth, categories, deal, contact);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}
