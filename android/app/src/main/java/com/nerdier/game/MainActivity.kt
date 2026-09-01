package com.nerdier.game

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.nerdier.game.data.defaultStatsRepository
import com.nerdier.game.ui.theme.NerdierTheme

/**
 * Single activity; everything above it is Compose.
 *
 * Extends [ComponentActivity], NOT AppCompatActivity: `Theme.Nerdier` is parented
 * on the framework `android:Theme.Material.*` so the app does not drag in
 * AppCompat or the Material *views* library just to satisfy one manifest
 * attribute. An AppCompatActivity against that theme throws at startup.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // Process-scoped, cheap to build, and the DataStore behind it is a
        // singleton per file — so there is no DI container here on purpose.
        val statsRepository = defaultStatsRepository(applicationContext)

        setContent {
            NerdierTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    NerdierApp(statsRepository = statsRepository)
                }
            }
        }
    }
}
