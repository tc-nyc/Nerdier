package com.nerdier.game.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf

private val NerdierLightColorScheme = lightColorScheme(
    primary = NerdierIndigo,
    onPrimary = LightSurface,
    primaryContainer = NerdierIndigoLightBg,
    onPrimaryContainer = LightOnSurface,
    secondary = PresentPurpleLight,
    onSecondary = OnPresentLight,
    tertiary = CorrectGreenLight,
    onTertiary = OnCorrectLight,
    background = LightBackground,
    onBackground = LightOnSurface,
    surface = LightSurface,
    onSurface = LightOnSurface,
    surfaceVariant = LightSurfaceVariant,
    onSurfaceVariant = LightOnSurfaceVariant,
    outline = LightOutline,
    outlineVariant = TileEmptyBorderLight,
    error = LightError,
    onError = LightOnError,
    errorContainer = LightErrorContainer,
    onErrorContainer = LightOnErrorContainer,
)

private val NerdierDarkColorScheme = darkColorScheme(
    primary = NerdierIndigoDark,
    onPrimary = DarkBackground,
    primaryContainer = NerdierIndigoDarkBg,
    onPrimaryContainer = DarkOnSurface,
    secondary = PresentPurpleDark,
    onSecondary = OnPresentDark,
    tertiary = CorrectGreenDark,
    onTertiary = OnCorrectDark,
    background = DarkBackground,
    onBackground = DarkOnSurface,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkOnSurfaceVariant,
    outline = DarkOutline,
    outlineVariant = TileEmptyBorderDark,
    error = DarkError,
    onError = DarkOnError,
    errorContainer = DarkErrorContainer,
    onErrorContainer = DarkOnErrorContainer,
)

/** Game-semantic colours, provided alongside the Material scheme. */
val LocalNerdierColors = staticCompositionLocalOf { LightNerdierColors }

/**
 * App theme.
 *
 * NOTE: there is intentionally **no** `dynamicColor` parameter and no call to
 * `dynamicLightColorScheme` / `dynamicDarkColorScheme`. Green, purple and black
 * encode game information; letting the wallpaper repaint them would change what
 * the board means from phone to phone.
 */
@Composable
fun NerdierTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) NerdierDarkColorScheme else NerdierLightColorScheme
    val nerdierColors = if (darkTheme) DarkNerdierColors else LightNerdierColors

    CompositionLocalProvider(LocalNerdierColors provides nerdierColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = NerdierTypography,
            content = content,
        )
    }
}

/**
 * Shorthand accessor for the game palette: `NerdierTokens.colors.correct`.
 * Reading [LocalNerdierColors] directly works just as well.
 */
object NerdierTokens {
    val colors: NerdierColors
        @Composable @ReadOnlyComposable get() = LocalNerdierColors.current
}
