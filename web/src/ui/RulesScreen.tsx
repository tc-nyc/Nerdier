import { GuessTile } from './TileGrid'
import { BackIcon } from './Icons'
import { KathrynEasterEgg } from './KathrynEasterEgg'
import { strings } from './strings'
import './Chrome.css'
import './RulesScreen.css'

export interface RulesScreenProps {
  readonly onBack: () => void
}

export function RulesScreen({ onBack }: RulesScreenProps) {
  return (
    <div className="nd-subscreen">
      <header className="nd-appbar">
        <button
          type="button"
          className="nd-iconbutton"
          aria-label={strings.actionBack}
          onClick={onBack}
        >
          <BackIcon />
        </button>
        <h1 className="nd-appbar__title">{strings.rulesTitle}</h1>
      </header>

      <div className="nd-subscreen__content">
        <div className="nd-subscreen__inner nd-rules">
          <p className="nd-rules__intro">{strings.rulesIntro}</p>

          <h2>{strings.rulesHFormat}</h2>
          <ul>
            {strings.rulesFormat.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <h2>{strings.rulesHMaths}</h2>
          <ul>
            {strings.rulesMaths.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>

          <h2>{strings.rulesHColours}</h2>
          <ul className="nd-rules__key">
            <li>
              <GuessTile
                tile={{ char: '4', state: 'correct' }}
                description="Example tile: green"
              />
              <span>{strings.rulesColourGreen}</span>
            </li>
            <li>
              <GuessTile
                tile={{ char: '7', state: 'present' }}
                description="Example tile: purple"
              />
              <span>{strings.rulesColourPurple}</span>
            </li>
            <li>
              <GuessTile
                tile={{ char: '*', state: 'absent' }}
                description="Example tile: black"
              />
              <span>{strings.rulesColourBlack}</span>
            </li>
          </ul>
          <ul>
            <li>{strings.rulesColourNote}</li>
          </ul>

          <h2>{strings.rulesHWinning}</h2>
          <ul>
            {strings.rulesWinning.map((line) => (
              <li key={line}>{line}</li>
            ))}
            <li>{strings.rulesWinningKathryn}</li>
            {/* Owns only its own "is the gag on screen" state; no game state
                is touched, and the layer it raises is pointer-events: none, so
                this screen keeps scrolling while it plays. */}
            <li className="nd-rules__egg">
              <KathrynEasterEgg />
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
