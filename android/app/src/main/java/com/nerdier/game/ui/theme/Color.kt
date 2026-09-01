package com.nerdier.game.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/* ---------------------------------------------------------------------------
 * Nerdier palette.
 *
 * Dynamic colour is deliberately OFF (see Theme.kt): green / purple / black
 * carry game meaning, so they must be byte-identical on every device.
 * Every value below is a literal — nothing is derived from the wallpaper.
 * ------------------------------------------------------------------------- */

// --- Brand / chrome -------------------------------------------------------

val NerdierIndigo         = Color(0xFF3F4EA8)
val NerdierIndigoLightBg  = Color(0xFFE1E3FA)
val NerdierIndigoDark     = Color(0xFFB6BEFF)
val NerdierIndigoDarkBg   = Color(0xFF262F6E)

val LightBackground       = Color(0xFFFAFAFC)
val LightSurface          = Color(0xFFFFFFFF)
val LightSurfaceVariant   = Color(0xFFE6E7EC)
val LightOnSurface        = Color(0xFF1A1C1F)
val LightOnSurfaceVariant = Color(0xFF44474E)
val LightOutline          = Color(0xFF757780)

val DarkBackground        = Color(0xFF111316)
val DarkSurface           = Color(0xFF181B1F)
val DarkSurfaceVariant    = Color(0xFF2A2E34)
val DarkOnSurface         = Color(0xFFE4E6EA)
val DarkOnSurfaceVariant  = Color(0xFFC2C6CD)
val DarkOutline           = Color(0xFF8A8F98)

val LightError            = Color(0xFFB3261E)
val LightOnError          = Color(0xFFFFFFFF)
val LightErrorContainer   = Color(0xFFF9DEDC)
val LightOnErrorContainer = Color(0xFF410E0B)

val DarkError             = Color(0xFFF2B8B5)
val DarkOnError           = Color(0xFF601410)
val DarkErrorContainer    = Color(0xFF8C1D18)
val DarkOnErrorContainer  = Color(0xFFF9DEDC)

// --- Tile semantics -------------------------------------------------------
// Light theme: filled tiles are dark enough that white glyphs clear 4.5:1.

val CorrectGreenLight     = Color(0xFF2E7D32)
val OnCorrectLight        = Color(0xFFFFFFFF)
val PresentPurpleLight    = Color(0xFF6C3FB0)
val OnPresentLight        = Color(0xFFFFFFFF)
val AbsentBlackLight      = Color(0xFF2B2E33)
val OnAbsentLight         = Color(0xFFFFFFFF)
val AbsentBorderLight     = Color(0xFF2B2E33)

// Dark theme: fills stay dark enough for white glyphs, and every fill also
// gets a lighter border so it separates from the near-black page. The ABSENT
// border is deliberately the brightest of the three — a black tile on a black
// background is otherwise invisible.

val CorrectGreenDark      = Color(0xFF2E7D46)
val OnCorrectDark         = Color(0xFFFFFFFF)
val CorrectBorderDark     = Color(0xFF5FBF83)
val PresentPurpleDark     = Color(0xFF6A3FB0)
val OnPresentDark         = Color(0xFFFFFFFF)
val PresentBorderDark     = Color(0xFFB79CE8)
val AbsentBlackDark       = Color(0xFF23262B)
val OnAbsentDark          = Color(0xFFE4E6EA)
val AbsentBorderDark      = Color(0xFF6E747E)

// Unrevealed tiles: outline only, never filled, in both themes.
val TileEmptyBorderLight  = Color(0xFFC6C9D0)
val TileFilledBorderLight = Color(0xFF6E727A)
val TileEmptyBorderDark   = Color(0xFF3A3E45)
val TileFilledBorderDark  = Color(0xFF8A8F98)

/**
 * Game colours that Material 3's [androidx.compose.material3.ColorScheme] has
 * no slot for. Supplied through [LocalNerdierColors]; see Theme.kt.
 *
 * Each state has a fill, an "on" colour for the glyph, and a border. Borders
 * are what keep ABSENT tiles legible in dark mode.
 */
@Immutable
data class NerdierColors(
    val correct: Color,
    val onCorrect: Color,
    val correctBorder: Color,
    val present: Color,
    val onPresent: Color,
    val presentBorder: Color,
    val absent: Color,
    val onAbsent: Color,
    val absentBorder: Color,
    val tileEmptyBorder: Color,
    val tileFilledBorder: Color,
    val keyIdle: Color,
    val onKeyIdle: Color,
    val chartBar: Color,
    val chartBarMuted: Color,
)

val LightNerdierColors = NerdierColors(
    correct = CorrectGreenLight,
    onCorrect = OnCorrectLight,
    correctBorder = CorrectGreenLight,
    present = PresentPurpleLight,
    onPresent = OnPresentLight,
    presentBorder = PresentPurpleLight,
    absent = AbsentBlackLight,
    onAbsent = OnAbsentLight,
    absentBorder = AbsentBorderLight,
    tileEmptyBorder = TileEmptyBorderLight,
    tileFilledBorder = TileFilledBorderLight,
    keyIdle = LightSurfaceVariant,
    onKeyIdle = LightOnSurface,
    chartBar = CorrectGreenLight,
    chartBarMuted = LightSurfaceVariant,
)

val DarkNerdierColors = NerdierColors(
    correct = CorrectGreenDark,
    onCorrect = OnCorrectDark,
    correctBorder = CorrectBorderDark,
    present = PresentPurpleDark,
    onPresent = OnPresentDark,
    presentBorder = PresentBorderDark,
    absent = AbsentBlackDark,
    onAbsent = OnAbsentDark,
    absentBorder = AbsentBorderDark,
    tileEmptyBorder = TileEmptyBorderDark,
    tileFilledBorder = TileFilledBorderDark,
    keyIdle = DarkSurfaceVariant,
    onKeyIdle = DarkOnSurface,
    chartBar = CorrectGreenDark,
    chartBarMuted = DarkSurfaceVariant,
)
