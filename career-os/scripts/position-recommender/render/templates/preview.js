const filter = document.querySelector("#candidate-filter");
const rows = [...document.querySelectorAll(".candidate-row")];
const status = document.querySelector("#filter-status");
const buttons = [...document.querySelectorAll(".quick-filters button")];
let activeTerms = [];
const updateCandidates = () => {
  const query = filter?.value.trim().toLowerCase() ?? "";
  let visible = 0;
  for (const row of rows) {
    const text = row.dataset.search ?? "";
    const matchesQuery = !query || text.includes(query);
    const matchesFilter =
      activeTerms.length === 0 || activeTerms.some((term) => text.includes(term));
    row.hidden = !(matchesQuery && matchesFilter);
    if (!row.hidden) visible += 1;
  }
  if (status)
    status.textContent =
      query || activeTerms.length ? visible + "건 검색됨" : "전체 " + rows.length + "건";
};
filter?.addEventListener("input", updateCandidates);
for (const button of buttons)
  button.addEventListener("click", () => {
    activeTerms = button.dataset.filter ? button.dataset.filter.split("|") : [];
    for (const item of buttons) item.setAttribute("aria-pressed", String(item === button));
    updateCandidates();
  });
