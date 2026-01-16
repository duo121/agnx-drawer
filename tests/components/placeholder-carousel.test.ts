import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
    shouldShowTabIcon,
    shouldTabFill,
    getTabFillText,
} from "@/components/chat/placeholder-carousel"
import {
    type TipItem,
    type FeatureTip,
    type ExampleTip,
} from "@/hooks/use-placeholder-carousel"

// ============ Arbitraries for Property-Based Testing ============

// Generate a valid FeatureTip
const featureTipArb: fc.Arbitrary<FeatureTip> = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    type: fc.constant("feature" as const),
    displayText: fc.string({ minLength: 1, maxLength: 100 }),
})

// Generate a valid ExampleTip
const exampleTipArb: fc.Arbitrary<ExampleTip> = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    type: fc.constant("example" as const),
    displayText: fc.string({ minLength: 1, maxLength: 100 }),
    fillText: fc.string({ minLength: 1, maxLength: 200 }),
})

// Generate a TipItem (either FeatureTip or ExampleTip)
const tipItemArb: fc.Arbitrary<TipItem> = fc.oneof(featureTipArb, exampleTipArb)

// ============ Property 5: Tab Icon Display by Tip Type ============
// Feature: input-placeholder-carousel, Property 5: Tab Icon Display by Tip Type
// *For any* rendered tip:
// - If the tip is an ExampleTip, the Tab icon must be visible
// - If the tip is a FeatureTip, the Tab icon must not be visible
// **Validates: Requirements 5.1, 5.2**

describe("Property 5: Tab Icon Display by Tip Type", () => {
    it("should show Tab icon for ExampleTip", () => {
        fc.assert(
            fc.property(exampleTipArb, (tip) => {
                const result = shouldShowTabIcon(tip)
                expect(result).toBe(true)
            }),
            { numRuns: 100 }
        )
    })

    it("should NOT show Tab icon for FeatureTip", () => {
        fc.assert(
            fc.property(featureTipArb, (tip) => {
                const result = shouldShowTabIcon(tip)
                expect(result).toBe(false)
            }),
            { numRuns: 100 }
        )
    })

    it("should correctly determine Tab icon visibility for any TipItem", () => {
        fc.assert(
            fc.property(tipItemArb, (tip) => {
                const shouldShow = shouldShowTabIcon(tip)
                
                // Tab icon should be shown if and only if tip is an ExampleTip
                if (tip.type === "example") {
                    expect(shouldShow).toBe(true)
                } else {
                    expect(shouldShow).toBe(false)
                }
            }),
            { numRuns: 100 }
        )
    })
})

// ============ Property 4: Tab Key Behavior by Tip Type ============
// Feature: input-placeholder-carousel, Property 4: Tab Key Behavior by Tip Type
// *For any* Tab key press event:
// - If the current tip is an ExampleTip, the input field must be filled with `fillText`
// - If the current tip is a FeatureTip, the input field must remain unchanged
// **Validates: Requirements 4.1, 4.2**

describe("Property 4: Tab Key Behavior by Tip Type", () => {
    it("should allow Tab fill for ExampleTip", () => {
        fc.assert(
            fc.property(exampleTipArb, (tip) => {
                const canFill = shouldTabFill(tip)
                expect(canFill).toBe(true)
            }),
            { numRuns: 100 }
        )
    })

    it("should NOT allow Tab fill for FeatureTip", () => {
        fc.assert(
            fc.property(featureTipArb, (tip) => {
                const canFill = shouldTabFill(tip)
                expect(canFill).toBe(false)
            }),
            { numRuns: 100 }
        )
    })

    it("should return correct fill text based on tip type", () => {
        fc.assert(
            fc.property(tipItemArb, (tip) => {
                const fillText = getTabFillText(tip)
                
                if (tip.type === "example") {
                    // ExampleTip should return its fillText
                    expect(fillText).toBe(tip.fillText)
                    expect(fillText.length).toBeGreaterThan(0)
                } else {
                    // FeatureTip should return empty string
                    expect(fillText).toBe("")
                }
            }),
            { numRuns: 100 }
        )
    })

    it("should correctly determine Tab fill behavior for any TipItem", () => {
        fc.assert(
            fc.property(tipItemArb, (tip) => {
                const canFill = shouldTabFill(tip)
                const fillText = getTabFillText(tip)
                
                // Tab fill should be allowed if and only if tip is an ExampleTip
                if (tip.type === "example") {
                    expect(canFill).toBe(true)
                    expect(fillText).toBe(tip.fillText)
                } else {
                    expect(canFill).toBe(false)
                    expect(fillText).toBe("")
                }
            }),
            { numRuns: 100 }
        )
    })
})
