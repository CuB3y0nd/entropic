import assert from "node:assert/strict";
import { test } from "node:test";
import type { SiteBadge } from "../../src/features/site-badges/model";
import { shuffleBadgeOrder } from "../../src/features/site-badges/order";

test("every three-button permutation is reachable without changing items or separating images from actions", () => {
  const badges: readonly SiteBadge[] = Object.freeze([
    Object.freeze({ label: "Link", imageSrc: "/link.png", href: "https://example.org/" }),
    Object.freeze({ label: "Copy", imageSrc: "/copy.gif", copyText: "username" }),
    Object.freeze({ label: "Email", imageSrc: "/email.gif", href: "mailto:hello@example.org" })
  ]);
  const permutations = new Set<string>();
  for (let first = 0; first < 3; first += 1) {
    for (let second = 0; second < 2; second += 1) {
      const order = shuffleBadgeOrder(badges, (exclusiveMax) => (exclusiveMax === 3 ? first : second));
      assert.equal(order.length, badges.length);
      assert.deepEqual(new Set(order), new Set(badges));
      assert.ok(
        order.every((badge) => badges.includes(badge)),
        "Keep the original complete button objects"
      );
      permutations.add(order.map(({ label }) => label).join(","));
    }
  }
  assert.equal(permutations.size, 6, "All six equally likely random-choice paths produce distinct permutations");
  assert.deepEqual(
    badges.map(({ label }) => label),
    ["Link", "Copy", "Email"]
  );
});

test("empty and single-button lists need no random draw", () => {
  const unexpectedDraw = () => {
    throw new Error("No random choice is needed");
  };
  const badge: SiteBadge = { label: "One", imageSrc: "/one.gif", href: "/" };
  assert.deepEqual(shuffleBadgeOrder([], unexpectedDraw), []);
  assert.deepEqual(shuffleBadgeOrder([badge], unexpectedDraw), [badge]);
});
