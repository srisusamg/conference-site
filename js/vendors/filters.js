export function buildCategoryOptions(vendors) {
  const categories = new Set();

  vendors.forEach((vendor) => {
    (vendor.categories || []).forEach((category) => {
      categories.add(category);
    });
  });

  return Array.from(categories).sort();
}

export function applyFilters(vendors, filters) {
  const categoryFilter = filters.category || "all";
  const query = (filters.query || "").trim().toLowerCase();

  return vendors.filter((vendor) => {
    if (categoryFilter !== "all") {
      const categories = vendor.categories || [];
      if (!categories.includes(categoryFilter)) {
        return false;
      }
    }

    if (!query) {
      return true;
    }

    const haystack = [
      vendor.name,
      vendor.booth,
      vendor.deal,
      ...(vendor.categories || [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
