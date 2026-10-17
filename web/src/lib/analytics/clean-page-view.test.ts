import { describe, expect, test } from "vitest";
import { cleanPageView } from "./clean-page-view";

const view = (url: string) => ({ type: "pageview" as const, url });

describe("LG-FR-17 (1.4) page counts carry no secrets", () => {
  test("the brand's invite token is never sent", () => {
    expect(cleanPageView(view("https://sponing.com/b/tok_8f2a91c4e7"))).toEqual(view("https://sponing.com/b/[token]"));
  });

  test("the query string and the fragment are dropped", () => {
    expect(cleanPageView(view("https://sponing.com/sign-in?next=%2Fdeals%2Fdeal_1#top"))).toEqual(view("https://sponing.com/sign-in"));
    expect(cleanPageView(view("https://sponing.com/b/tok_8f2a91c4e7?from=email"))).toEqual(view("https://sponing.com/b/[token]"));
  });

  test("any other address is sent as it is", () => {
    expect(cleanPageView(view("https://sponing.com/deals/deal_1/deliverables/del_2"))).toEqual(view("https://sponing.com/deals/deal_1/deliverables/del_2"));
    expect(cleanPageView(view("https://sponing.com/brand/deals/deal_1"))).toEqual(view("https://sponing.com/brand/deals/deal_1"));
  });
});
