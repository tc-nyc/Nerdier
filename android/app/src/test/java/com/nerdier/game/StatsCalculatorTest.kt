package com.nerdier.game

import com.nerdier.game.data.GameRecord
import com.nerdier.game.data.StatsCalculator
import com.nerdier.game.data.StatsPeriod
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Period bucketing and rollups. Fixed to UTC and to explicit dates so nothing
 * here depends on the machine's clock or locale — week/month boundaries are
 * exactly where off-by-one errors hide.
 */
class StatsCalculatorTest {

    private val utc: ZoneId = ZoneId.of("UTC")

    /** Epoch millis for a date at midday UTC, safely clear of any day boundary. */
    private fun at(date: String): Long =
        LocalDate.parse(date).atTime(LocalTime.NOON).atZone(utc).toInstant().toEpochMilli()

    private fun inPeriod(day: String, today: String, period: StatsPeriod): Boolean =
        StatsCalculator.isInPeriod(LocalDate.parse(day), LocalDate.parse(today), period)

    // ---- week boundaries ----------------------------------------------------
    // 2026-08-17 is a Monday; 2026-08-23 is the Sunday that closes that week.

    @Test
    fun `week starts on monday`() {
        assertEquals(LocalDate.parse("2026-08-17"), StatsCalculator.weekStart(LocalDate.parse("2026-08-21")))
        assertEquals(
            "a Monday is its own week start",
            LocalDate.parse("2026-08-17"),
            StatsCalculator.weekStart(LocalDate.parse("2026-08-17"))
        )
    }

    @Test
    fun `week includes its monday and its sunday`() {
        assertTrue(inPeriod("2026-08-17", "2026-08-21", StatsPeriod.THIS_WEEK))
        assertTrue("Sunday closes the week, it does not start the next one",
            inPeriod("2026-08-23", "2026-08-21", StatsPeriod.THIS_WEEK))
    }

    @Test
    fun `week excludes the day either side`() {
        assertFalse(inPeriod("2026-08-16", "2026-08-21", StatsPeriod.THIS_WEEK)) // prior Sunday
        assertFalse(inPeriod("2026-08-24", "2026-08-21", StatsPeriod.THIS_WEEK)) // next Monday
    }

    @Test
    fun `week spanning a month boundary still holds together`() {
        // Mon 2026-08-31 .. Sun 2026-09-06
        assertTrue(inPeriod("2026-08-31", "2026-09-02", StatsPeriod.THIS_WEEK))
        assertTrue(inPeriod("2026-09-06", "2026-09-02", StatsPeriod.THIS_WEEK))
    }

    // ---- month boundaries ---------------------------------------------------

    @Test
    fun `month is calendar month and does not roll december into january`() {
        assertTrue(inPeriod("2026-08-01", "2026-08-21", StatsPeriod.THIS_MONTH))
        assertTrue(inPeriod("2026-08-31", "2026-08-21", StatsPeriod.THIS_MONTH))
        assertFalse(inPeriod("2026-07-31", "2026-08-21", StatsPeriod.THIS_MONTH))
        assertFalse(inPeriod("2026-09-01", "2026-08-21", StatsPeriod.THIS_MONTH))
        // Same month number, different year.
        assertFalse(inPeriod("2025-12-15", "2026-12-15", StatsPeriod.THIS_MONTH))
    }

    @Test
    fun `today is a single calendar day`() {
        assertTrue(inPeriod("2026-08-21", "2026-08-21", StatsPeriod.TODAY))
        assertFalse(inPeriod("2026-08-20", "2026-08-21", StatsPeriod.TODAY))
    }

    // ---- rollups ------------------------------------------------------------

    private val records = listOf(
        GameRecord(at("2026-08-10"), won = true, guessesUsed = 3),  // this month, but the PRIOR week
        GameRecord(at("2026-08-17"), won = false, guessesUsed = 6), // Monday of this week
        GameRecord(at("2026-08-21"), won = true, guessesUsed = 4),  // today
        GameRecord(at("2026-08-21"), won = true, guessesUsed = 2),  // today
        GameRecord(at("2026-07-30"), won = true, guessesUsed = 1),  // last month
    )

    private val now = at("2026-08-21")

    @Test
    fun `today rollup counts only today`() {
        val s = StatsCalculator.summarize(records, StatsPeriod.TODAY, now, utc)
        assertEquals(2, s.played)
        assertEquals(2, s.won)
        assertEquals(100, s.winPercent)
    }

    @Test
    fun `week rollup spans monday through today`() {
        val s = StatsCalculator.summarize(records, StatsPeriod.THIS_WEEK, now, utc)
        assertEquals("Aug 17 loss plus both Aug 21 wins", 3, s.played)
        assertEquals(2, s.won)
        assertEquals(67, s.winPercent) // 66.67 rounds half-up
    }

    @Test
    fun `month rollup excludes the previous month`() {
        val s = StatsCalculator.summarize(records, StatsPeriod.THIS_MONTH, now, utc)
        assertEquals("Jul 30 must not be counted", 4, s.played)
        assertEquals(3, s.won)
    }

    @Test
    fun `streak counts wins back from the most recent game and breaks on a loss`() {
        val s = StatsCalculator.summarize(records, StatsPeriod.THIS_MONTH, now, utc)
        assertEquals("two wins today, then the Aug 17 loss stops it", 2, s.currentStreak)
    }

    @Test
    fun `a loss as the most recent game zeroes the streak`() {
        val withLateLoss = records + GameRecord(at("2026-08-21") + 1, won = false, guessesUsed = 6)
        val s = StatsCalculator.summarize(withLateLoss, StatsPeriod.TODAY, now, utc)
        assertEquals(0, s.currentStreak)
    }

    @Test
    fun `guess distribution buckets wins by guesses used and ignores losses`() {
        val s = StatsCalculator.summarize(records, StatsPeriod.THIS_MONTH, now, utc)
        // index 0 == solved in 1 guess
        assertEquals(listOf(0, 1, 1, 1, 0, 0), s.guessDistribution)
    }

    @Test
    fun `empty history is all zeroes and does not divide by zero`() {
        val s = StatsCalculator.summarize(emptyList(), StatsPeriod.TODAY, now, utc)
        assertEquals(0, s.played)
        assertEquals(0, s.winPercent)
        assertEquals(0, s.currentStreak)
        assertEquals(1, s.maxDistributionCount)
    }
}
