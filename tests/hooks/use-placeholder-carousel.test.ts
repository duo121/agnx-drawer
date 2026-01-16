import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import * as fc from "fast-check"
import {
    usePlaceholderCarousel,
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

// Generate a non-empty array of TipItems
const tipItemsArb = fc.array(tipItemArb, { minLength: 1, maxLength: 20 })

// ============ Test Setup ============

describe("usePlaceholderCarousel", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    // ============ Property 2: Carousel Index Cycling ============
    // Feature: input-placeholder-carousel, Property 2: Carousel Index Cycling
    // *For any* sequence of tip rotations, when the current index reaches the last tip (tips.length - 1),
    // the next rotation must set the index back to 0.
    // **Validates: Requirements 2.4**

    describe("Property 2: Carousel Index Cycling", () => {
        it("should cycle index back to 0 after reaching the last tip", () => {
            fc.assert(
                fc.property(tipItemsArb, (tips) => {
                    const { result } = renderHook(() =>
                        usePlaceholderCarousel({
                            tips,
                            interval: 1000,
                            enabled: true,
                        })
                    )

                    // Initial index should be 0
                    expect(result.current.currentIndex).toBe(0)

                    // Advance through all tips
                    for (let i = 0; i < tips.length; i++) {
                        expect(result.current.currentIndex).toBe(i)
                        act(() => {
                            vi.advanceTimersByTime(1000)
                        })
                    }

                    // After cycling through all tips, index should be back to 0
                    expect(result.current.currentIndex).toBe(0)
                }),
                { numRuns: 100 }
            )
        })

        it("should maintain valid index bounds for any number of rotations", () => {
            fc.assert(
                fc.property(
                    tipItemsArb,
                    fc.integer({ min: 1, max: 50 }),
                    (tips, rotations) => {
                        const { result } = renderHook(() =>
                            usePlaceholderCarousel({
                                tips,
                                interval: 1000,
                                enabled: true,
                            })
                        )

                        // Perform multiple rotations
                        for (let i = 0; i < rotations; i++) {
                            act(() => {
                                vi.advanceTimersByTime(1000)
                            })
                            // Index should always be within bounds
                            expect(result.current.currentIndex).toBeGreaterThanOrEqual(0)
                            expect(result.current.currentIndex).toBeLessThan(tips.length)
                        }

                        // Final index should equal (rotations % tips.length)
                        const expectedIndex = rotations % tips.length
                        expect(result.current.currentIndex).toBe(expectedIndex)
                    }
                ),
                { numRuns: 100 }
            )
        })
    })


    // ============ Property 3: Hover Pause Behavior ============
    // Feature: input-placeholder-carousel, Property 3: Hover Pause Behavior
    // *For any* carousel state, when `isPaused` is true (due to hover), the `currentIndex` must not change
    // regardless of elapsed time.
    // **Validates: Requirements 3.1, 3.3**

    describe("Property 3: Hover Pause Behavior", () => {
        it("should not change index while paused regardless of elapsed time", () => {
            fc.assert(
                fc.property(
                    tipItemsArb,
                    fc.integer({ min: 1, max: 20 }),
                    fc.integer({ min: 1000, max: 30000 }),
                    (tips, initialRotations, pauseDuration) => {
                        const { result } = renderHook(() =>
                            usePlaceholderCarousel({
                                tips,
                                interval: 1000,
                                enabled: true,
                            })
                        )

                        // Advance to some initial position
                        for (let i = 0; i < initialRotations; i++) {
                            act(() => {
                                vi.advanceTimersByTime(1000)
                            })
                        }

                        const indexBeforePause = result.current.currentIndex

                        // Pause the carousel
                        act(() => {
                            result.current.pause()
                        })

                        expect(result.current.isPaused).toBe(true)

                        // Advance time while paused
                        act(() => {
                            vi.advanceTimersByTime(pauseDuration)
                        })

                        // Index should not have changed
                        expect(result.current.currentIndex).toBe(indexBeforePause)
                        expect(result.current.isPaused).toBe(true)
                    }
                ),
                { numRuns: 100 }
            )
        })

        it("should resume rotation after calling resume", () => {
            fc.assert(
                fc.property(tipItemsArb, (tips) => {
                    const { result } = renderHook(() =>
                        usePlaceholderCarousel({
                            tips,
                            interval: 1000,
                            enabled: true,
                        })
                    )

                    // Pause
                    act(() => {
                        result.current.pause()
                    })

                    expect(result.current.isPaused).toBe(true)
                    const indexWhilePaused = result.current.currentIndex

                    // Advance time while paused - should not change
                    act(() => {
                        vi.advanceTimersByTime(5000)
                    })
                    expect(result.current.currentIndex).toBe(indexWhilePaused)

                    // Resume
                    act(() => {
                        result.current.resume()
                    })

                    expect(result.current.isPaused).toBe(false)

                    // Now advancing time should change the index
                    act(() => {
                        vi.advanceTimersByTime(1000)
                    })

                    // Index should have advanced by 1 (or wrapped to 0 if at end)
                    const expectedIndex = (indexWhilePaused + 1) % tips.length
                    expect(result.current.currentIndex).toBe(expectedIndex)
                }),
                { numRuns: 100 }
            )
        })

        it("should maintain current tip display while hovering (paused)", () => {
            fc.assert(
                fc.property(
                    tipItemsArb,
                    fc.integer({ min: 0, max: 19 }),
                    (tips, rotationsBeforePause) => {
                        const actualRotations = rotationsBeforePause % tips.length

                        const { result } = renderHook(() =>
                            usePlaceholderCarousel({
                                tips,
                                interval: 1000,
                                enabled: true,
                            })
                        )

                        // Advance to a specific position
                        for (let i = 0; i < actualRotations; i++) {
                            act(() => {
                                vi.advanceTimersByTime(1000)
                            })
                        }

                        const tipBeforePause = result.current.currentTip

                        // Pause (simulating hover)
                        act(() => {
                            result.current.pause()
                        })

                        // Advance significant time
                        act(() => {
                            vi.advanceTimersByTime(10000)
                        })

                        // Current tip should be the same
                        expect(result.current.currentTip).toEqual(tipBeforePause)
                    }
                ),
                { numRuns: 100 }
            )
        })
    })
})
