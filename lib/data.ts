export type BudgetRecord = { year:number; approved:number; display:string; precision:"exact"|"reported-rounded"; sourceTitle:string; sourceUrl:string; sourceType:"official-document"|"official-portal"|"enactment-report"; note?:string };

// Original annual approved appropriations—not actual spending or revised budgets.
export const budgets: BudgetRecord[] = [
  {year:2018,approved:134_286_417_019,display:"₦134.286bn",precision:"exact",sourceTitle:"Niger State 2018 Approved Budget",sourceUrl:"/documents/niger-state-2018-approved-budget.pdf",sourceType:"official-document"},
  {year:2019,approved:164_450_868_735,display:"₦164.451bn",precision:"exact",sourceTitle:"Niger State 2019 Approved Budget",sourceUrl:"/documents/niger-state-2019-approved-budget.pdf",sourceType:"official-document"},
  {year:2020,approved:155_459_814_700.82,display:"₦155.460bn",precision:"exact",sourceTitle:"Niger State 2020 Approved Budget",sourceUrl:"/documents/niger-state-2020-approved-budget.pdf",sourceType:"official-document",note:"Original approved budget; later revised downward during COVID-19."},
  {year:2021,approved:153_412_621_776.37,display:"₦153.413bn",precision:"exact",sourceTitle:"Niger State 2021 Approved Budget",sourceUrl:"/documents/niger-state-2021-approved-budget.pdf",sourceType:"official-document",note:"Original approved budget; the later revision is excluded."},
  {year:2022,approved:211_020_000_000,display:"₦211.02bn",precision:"reported-rounded",sourceTitle:"Niger State 2022 Citizens' Budget",sourceUrl:"/documents/niger-state-2022-citizens-budget.pdf",sourceType:"official-document"},
  {year:2023,approved:243_647_189_978.88,display:"₦243.647bn",precision:"exact",sourceTitle:"Niger State 2023 Approved Budget",sourceUrl:"/documents/niger-state-2023-approved-budget.pdf",sourceType:"official-document"},
  {year:2024,approved:613_994_801_697,display:"₦613.995bn",precision:"exact",sourceTitle:"Niger State 2024 Approved Budget",sourceUrl:"/documents/niger-state-2024-approved-budget.pdf",sourceType:"official-document",note:"Original approved budget; excludes the later supplementary appropriation."},
  {year:2025,approved:1_558_887_565_358.21,display:"₦1.559tn",precision:"exact",sourceTitle:"Niger State 2025 Approved Budget",sourceUrl:"/documents/niger-state-2025-approved-budget.pdf",sourceType:"official-document"},
  {year:2026,approved:1_073_991_335_895,display:"₦1.074tn",precision:"exact",sourceTitle:"Niger State 2026 Approved Budget",sourceUrl:"/documents/niger-state-2026-approved-budget.pdf",sourceType:"official-document"},
];
export const latestBudget=budgets.at(-1)!;export const previousBudget=budgets.at(-2)!;
export const formatMoney=(value:number)=>value>=1e12?`₦${(value/1e12).toFixed(3)}tn`:`₦${(value/1e9).toFixed(3)}bn`;
export const annualChange=(current:BudgetRecord,prior:BudgetRecord)=>((current.approved-prior.approved)/prior.approved)*100;
