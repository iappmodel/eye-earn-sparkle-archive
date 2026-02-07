

# Eye-Control Targets System -- Placeable Screen Targets with Gesture Commands

## Overview

This feature adds a fully customizable **Target Command System** to the Remote Control. Users can place interactive targets anywhere on their screen, assign any app command to each target, and trigger those commands with simple micro-gestures (single blink, lip movement, face turn, gaze direction, etc.). The platform also suggests common target layouts and learns from user behavior over time.

## What It Does

### 1. Placeable Screen Targets
- Users open a **Target Editor** (a new tab in Remote Control settings) that shows a phone-shaped canvas representing their screen
- They can tap anywhere on the canvas to place a new target (circular hotspot)
- Targets can be dragged to reposition, resized, and removed
- Each target gets a label and an assigned command + trigger gesture
- Targets persist in localStorage and appear as semi-transparent overlays when Remote Control is active

### 2. Micro-Gesture Triggers
Each target can be triggered by any of these simple gestures:
Eyebrows left lift, eyebrows right lift, eyebrows both lift together, 
Smirk smile

Full real smile (user really enjoy and or trully smiles at a content and instantly donate anything designable or even save it in a liked folders, enjoyed that instantly gets saved in a liked galeries at saved videos

Face nudging

Side tilting

Slow blink

Lips movements

Screen touches (1 touch,  2 touchs, 3 touches,mutli touches,  touching timing assignment, holding, sliding, dragging , etc

Air movement (the user tilts the phone, any side, anywhere, in any way and that movement can be assigned to a command, 

sounds ( sounds can be assignednl to commands, like " a "uhum" to trigger any command in relation to the media, a Like,  a certain amount of vicoins, anything can be assigned to a sound or word, or a combination of words
The user can say "uhum, five" the command can be triggered to send "uhum=like" + 5= vicoins)
The user can say: "yes, 3" and the command "yes is assigned to icoins and the number 3 is assigned to the amount of icoins 

Face gestures and emotions like smile, smirk, sadness, happiness, excited, surprise, interesting,  interested,  not interested, attention-tracking, lost of ttention-tracking, loss of attention-tracking

Platform suggestions (the platform studies the users behavioral insights and strategize the commands for the user, after some time studying the user's behaviors the platform will learn about the user and suggest a better and more natural scrolling experience to the user
Like on google maps when a better route is suggested by the platform, when the platform hits a certain level of precision about the user's behavioral 1)



Screen touch (targets can be activated in screen touches
Buttons and targets can be placed and assigned any commands 

These targets
- **Single blink** -- one quick eye blink
- **Double blink** -- two rapid blinks
- **Triple blink** -- three rapid blinks
- **Left lip raise** -- slight lift of the left side of the mouth
- **Right lip raise** -- slight lift of the right side of the mouth
- **Slight face turn left** -- small head rotation to the left
- **Slight face turn right** -- small head rotation to the right
- **Look at target** -- simply gazing in the direction where the target is placed (gaze-activated)
- **Look + blink** -- look toward the target area and then blink to confirm
- **Combined gestures** -- any two gestures in sequence (e.g., lip raise then blink)

### 3. Any App Command Assignable
The full list of available commands includes everything the app can do:
- Like, Comment, Share, Save Video, Follow Creator
- Next Video, Previous Video
- Friends Feed, Promo Feed
- Open Settings, Toggle Mute
- Open Wallet, Open Profile, Open Map
- Open Messages, Open Achievements
- Open Route Builder, Open Saved Videos
- Start/Stop Remote Control
- Toggle Camera, Check In

### 4. Platform-Suggested Layouts
Pre-built target arrangements the user can apply with one tap:
- **Quick Actions** -- Like (bottom-right), Share (top-right), Save (center-right), Comment (bottom-left)
- **Navigation** -- Next (bottom-center), Previous (top-center), Friends (left-center), Promos (right-center)
- **Minimal** -- Just Like and Next in the bottom corners
- **Power User** -- Full grid with 8 targets covering all major actions

### 5. Behavioral Learning
The platform tracks which commands users trigger most, how accurately they hit targets, and adapts:
- Suggests relocating targets the user misses frequently
- Recommends adding targets for actions the user does manually (with touch) while Remote Control is on
- Gradually adjusts target hit-zones based on the user's gaze accuracy patterns
- Shows a "Smart Suggestions" section with recommendations like "You like videos 12x/hour -- add a Like target to your layout?"

## Technical Details

### New File: `src/hooks/useScreenTargets.ts`

Core hook managing the target system:

```
ScreenTarget interface:
  - id: string
  - label: string
  - command: AppCommand (expanded union of all app actions)
  - trigger: GestureTrigger (union of all micro-gesture types)
  - position: { x: number, y: number } (0-1 normalized)
  - size: number (radius in % of screen width, default 8)
  - enabled: boolean
  - createdAt: number

GestureTrigger type:
  - 'singleBlink' | 'doubleBlink' | 'tripleBlink'
  - 'lipRaiseLeft' | 'lipRaiseRight'
  - 'faceTurnLeft' | 'faceTurnRight'
  - 'gazeActivated' (just look at it)
  - 'gazeAndBlink' (look + blink to confirm)
  - { type: 'combined', steps: GestureTrigger[] }

AppCommand type (expanded):
  - All existing ComboAction values (like, comment, share, follow, etc.)
  - Plus: 'openWallet', 'openProfile', 'openMap', 'openMessages',
    'openAchievements', 'openRouteBuilder', 'openSavedVideos',
    'toggleRemoteControl', 'checkIn', 'tipCreator'

Functions:
  - loadTargets() / saveTargets() -- localStorage persistence
  - addTarget(target) / removeTarget(id) / updateTarget(id, updates)
  - applyPreset(presetId) -- loads a suggested layout
  - getTargetAtPosition(gazeX, gazeY) -- hit-test
  - recordInteraction(targetId, hit: boolean) -- for learning
  - getSuggestions() -- behavioral recommendations
```

Storage key: `app_screen_targets`
Behavior data key: `app_target_behavior`

### New File: `src/components/TargetEditor.tsx`

Visual editor showing a phone-shaped canvas where users place targets:
- Phone outline (rounded rectangle) filling the sheet
- Existing targets shown as draggable circles with icons/labels
- Tap empty space to add a new target (opens a mini form: choose command + trigger)
- Long-press a target to edit or delete it
- "Presets" button at top to load suggested layouts
- "Clear All" button
- Each target circle shows a small icon for its command and a badge for its trigger type

### New File: `src/components/TargetOverlay.tsx`

Runtime overlay rendered when Remote Control is active:
- Renders each enabled target as a semi-transparent circle at its screen position
- Highlights when gaze enters the target zone
- Shows activation progress ring (like ghost buttons)
- Fires the assigned command when the trigger gesture is detected while gazing at the target
- Animates success feedback (pulse + checkmark)

### New File: `src/components/TargetSuggestions.tsx`

"Smart Suggestions" panel inside the Targets tab:
- Shows behavioral insights: "You manually liked 15 times today while Remote Control was active"
- Suggests adding specific targets based on usage patterns
- Suggests repositioning targets with low accuracy
- One-tap "Apply Suggestion" buttons

### Modified File: `src/hooks/useGestureCombos.ts`

Expand `ComboAction` type to include all new app commands:
```
export type ComboAction =
  | 'like' | 'comment' | 'share' | 'follow'
  | 'nextVideo' | 'prevVideo' | 'friendsFeed' | 'promoFeed'
  | 'openSettings' | 'toggleMute' | 'save'
  | 'openWallet' | 'openProfile' | 'openMap'
  | 'openMessages' | 'openAchievements'
  | 'openRouteBuilder' | 'openSavedVideos'
  | 'toggleRemoteControl' | 'checkIn' | 'tipCreator'
  | 'none';
```

Update `COMBO_ACTION_LABELS` with labels for all new actions.

### Modified File: `src/components/GestureComboBuilder.tsx`

Add the new actions to the `ACTION_OPTIONS` array so custom combos can also target the expanded command set.

### Modified File: `src/components/BlinkRemoteControl.tsx`

Add a 6th tab: **"Targets"** to the settings sheet (changing the grid from 5 to 6 columns):
- Contains the `TargetEditor` component
- Contains the `TargetSuggestions` panel
- Contains the preset layouts section

### Modified File: `src/components/FloatingControls.tsx`

- Render `<TargetOverlay />` when remote control is enabled
- Pass the expanded `onComboAction` handler to support new commands

### Modified File: `src/pages/Index.tsx`

Expand the `onComboAction` switch to handle all new commands:
```
case 'openWallet': setShowWallet(true); break;
case 'openProfile': setShowProfile(true); break;
case 'openMap': setShowMap(true); break;
case 'openMessages': setShowMessages(true); break;
case 'openAchievements': setShowAchievementsPanel(true); break;
case 'openRouteBuilder': setShowRouteBuilderFromFeed(true); break;
case 'openSavedVideos': setShowSavedGallery(true); break;
case 'checkIn': toast.success('Checked in!'); break;
case 'tipCreator': toast.info('Tip creator'); break;
```

## Summary of Files

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useScreenTargets.ts` | New | Core target state, persistence, hit-testing, behavioral learning |
| `src/components/TargetEditor.tsx` | New | Visual drag-and-drop editor on phone canvas |
| `src/components/TargetOverlay.tsx` | New | Runtime gaze-activated target circles |
| `src/components/TargetSuggestions.tsx` | New | Behavioral learning suggestions panel |
| `src/hooks/useGestureCombos.ts` | Modified | Expand ComboAction + labels for all app commands |
| `src/components/GestureComboBuilder.tsx` | Modified | Add new actions to builder options |
| `src/components/BlinkRemoteControl.tsx` | Modified | Add "Targets" tab with editor, presets, suggestions |
| `src/components/FloatingControls.tsx` | Modified | Render TargetOverlay, pass expanded handler |
| `src/pages/Index.tsx` | Modified | Handle all new command actions in onComboAction |

No new dependencies. No database changes. All data stored in localStorage.


