package com.nerdier.game.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row as LayoutRow
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.nerdier.game.R
import com.nerdier.game.model.Tile
import com.nerdier.game.model.TileState
import com.nerdier.game.ui.components.GuessTile
import com.nerdier.game.ui.theme.NerdierTheme

/**
 * How to Play. Long-form copy lives in `res/values/strings.xml` so it is
 * translatable and so this file stays a layout file.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RulesScreen(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.rules_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back),
                        )
                    }
                },
            )
        },
    ) { insets ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(insets)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
        ) {
            Text(
                text = stringResource(R.string.rules_intro),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )

            SectionHeading(R.string.rules_h_format)
            Bullet(R.string.rules_format_1)
            Bullet(R.string.rules_format_2)
            Bullet(R.string.rules_format_3)
            Bullet(R.string.rules_format_4)
            Bullet(R.string.rules_format_5)

            SectionHeading(R.string.rules_h_maths)
            Bullet(R.string.rules_maths_1)
            Bullet(R.string.rules_maths_2)
            Bullet(R.string.rules_maths_3)

            SectionHeading(R.string.rules_h_colours)
            ColourExample(
                char = '4',
                state = TileState.CORRECT,
                textRes = R.string.rules_colour_green,
            )
            ColourExample(
                char = '7',
                state = TileState.PRESENT,
                textRes = R.string.rules_colour_purple,
            )
            ColourExample(
                char = '*',
                state = TileState.ABSENT,
                textRes = R.string.rules_colour_black,
            )
            Spacer(Modifier.height(8.dp))
            Bullet(R.string.rules_colour_note)

            SectionHeading(R.string.rules_h_winning)
            Bullet(R.string.rules_winning_1)
            Bullet(R.string.rules_winning_1b)
            Bullet(R.string.rules_winning_2)

            Spacer(Modifier.height(28.dp))
        }
    }
}

@Composable
private fun SectionHeading(textRes: Int) {
    Text(
        text = stringResource(textRes),
        style = MaterialTheme.typography.titleLarge,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.padding(top = 24.dp, bottom = 8.dp),
    )
}

@Composable
private fun Bullet(textRes: Int) {
    LayoutRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "•",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.clearAndSetSemantics { },
        )
        Text(
            text = stringResource(textRes),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** A live tile beside its explanation, so the colour key is the real thing. */
@Composable
private fun ColourExample(char: Char, state: TileState, textRes: Int) {
    val exampleLabel = "Example tile: " + when (state) {
        TileState.CORRECT -> "green"
        TileState.PRESENT -> "purple"
        else -> "black"
    }
    LayoutRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        GuessTile(
            tile = Tile(char, state),
            size = 44.dp,
            rowNumber = 0,
            columnNumber = 1,
            descriptionOverride = exampleLabel,
        )
        Text(
            text = stringResource(textRes),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Preview(name = "Rules - light", widthDp = 360, heightDp = 900, showBackground = true)
@Composable
private fun RulesLightPreview() {
    NerdierTheme(darkTheme = false) {
        Box(Modifier.fillMaxSize()) { RulesScreen(onBack = {}) }
    }
}

@Preview(name = "Rules - dark", widthDp = 360, heightDp = 900, showBackground = true)
@Composable
private fun RulesDarkPreview() {
    NerdierTheme(darkTheme = true) {
        Box(Modifier.fillMaxSize()) { RulesScreen(onBack = {}) }
    }
}
