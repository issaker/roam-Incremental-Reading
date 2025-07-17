# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building and Development
- `npm run dev` - Start webpack in watch mode for development 
- `npm run build` - Build for production
- `npm start` - Alias for `npm run dev`

### Code Quality
- `npm run lint` - ESLint for TypeScript/JavaScript files
- `npm run typecheck` - Run TypeScript compiler checks
- `npm run format` - Format code with Prettier

### Testing
- `npm test` - Run Jest tests with UTC timezone
- `npm test-dev` - Run tests in watch mode with verbose output
- `npm test-debug` - Run tests with Node.js debugger attached

## Project Architecture

### Core Structure
This is a **Roam Research browser extension** for spaced repetition learning (similar to Anki). The project is built with:
- **React 17** + TypeScript for UI components
- **Webpack** for bundling into a single `extension.js` file
- **Blueprint.js** for UI components
- **FSRS algorithm** and **SuperMemo SM2** for spaced repetition scheduling

### Key Entry Points
- `src/extension.tsx` - Main extension entry point that initializes the app and handles plugin lifecycle
- `src/app.tsx` - Root React component managing global state and coordination
- `extension.js` - Final webpack output that gets loaded by Roam Research

### Architecture Components

#### Memory Algorithms
- `src/practice.ts` - Core practice logic with dual algorithm support (SM2/FSRS)
- `src/algorithms/fsrs.ts` - Modern FSRS (Free Spaced Repetition Scheduler) implementation  
- `supermemo()` function in `practice.ts` - Classic SM2 algorithm implementation

#### State Management
- Custom hooks pattern for state management (no Redux/Context)
- `src/hooks/useSettings.ts` - Extension settings management
- `src/hooks/usePracticeData.tsx` - Practice session data and card management
- `src/hooks/useDeckPriority.tsx` - Deck priority and global mixed mode logic

#### UI Components
- `src/components/SidePanelWidget.tsx` - Sidebar review button integration
- `src/components/overlay/PracticeOverlay.tsx` - Main practice/review interface
- `src/components/DeckPriorityManager.tsx` - Deck priority management interface

#### Data Layer
- `src/queries/` - Roam Research database interaction utilities
- `src/queries/data.ts` - Main data fetching for cards and practice records
- `src/queries/save.ts` - Saving practice results back to Roam

### Key Features Implemented

#### Dual Algorithm Support
The extension supports both SM2 (classic) and FSRS (modern AI-based) scheduling algorithms. Algorithm selection is per-session and controlled via settings. Both algorithms maintain separate historical data.

#### Global Mixed Mode vs Single Deck Mode  
- **Single Deck Mode**: Study cards from one specific Roam page/tag at a time
- **Global Mixed Mode**: Study cards from all decks mixed together, ordered by global priority
- Mode switching is handled in `src/app.tsx:75-78`

#### Priority System
**Current Implementation**: Array-based priority management for performance and reliability
- **ArrayPriorityManager** (`src/utils/ArrayPriorityManager.ts`):
  - Primary system using array indices instead of floating-point priorities
  - Optimized for large card collections with O(1) lookups
  - Serializable format for persistence in Roam database
  - Migration support from legacy floating-point format

- **Individual Card Priority** (`src/components/PrioritySlider.tsx`):
  - Real-time position adjustment within card collection
  - Visual feedback with total card count
  - Integrated with practice overlay interface

- **Deck Management** (`src/components/DeckManager.tsx`):
  - Bulk deck priority operations and ordering
  - Priority calculation based on card collection medians
  - Support for global mixed mode vs single deck mode

**Legacy Systems** (deprecated but supported for migration):
- `src/utils/PriorityManager.ts` - Original floating-point system
- `src/utils/DualChannelPriorityManager.ts` - Audio-inspired bias/scale system

#### Roam Integration Fixes
- `src/utils/roamZIndexManager.ts` - Fixes z-index conflicts with Roam's UI layers
- `src/utils/roamFocusManager.ts` - Fixes focus loss issues when editing in practice mode
- Both managers are cleaned up properly on extension unload
- Mobile layout compatibility and duplicate container prevention

### Testing
- Jest configuration in `package.json` with jsdom environment
- Test setup file: `jest.setup.ts`
- Module path mapping: `~` points to `src/`
- Tests use `@testing-library/react` for component testing
- Run single test: `npm test -- --testNamePattern="test name"`
- Debug tests: `npm run test-debug` (opens Node.js debugger)

### Build Configuration
- Webpack externalizes React, ReactDOM, and Blueprint.js (provided by Roam)
- TypeScript path mapping via `tsconfig-paths-webpack-plugin` (`~` → `src/`)
- Output: single `extension.js` file as ES module
- Development builds include inline source maps
- Production builds are minified and optimized

## Development Notes

### Roam Research Extension API
- Extensions receive `extensionAPI` object with settings and Roam database access
- Global `window.roamMemo.extensionAPI` provides access throughout the app
- Extension lifecycle: `onload()` initializes, `onunload()` cleans up

### Card Data Structure  
Cards are Roam blocks tagged with `#memo` (or custom tags). Practice history is stored in a dedicated Roam page (default: `roam/memo`) with a specific data structure that tracks intervals, repetitions, and algorithm state.

### Key State Flow
1. `useAllPages` discovers all Roam pages as potential decks
2. `usePracticeData` fetches cards and practice history for selected deck(s)
3. `PracticeOverlay` handles the review session UI and scoring
4. `practice()` function calculates next review date using selected algorithm
5. Results saved back to Roam via `savePracticeData()`

### Priority Management Architecture
- **DualChannelPriorityManager**: Advanced priority system with bias/scale adjustments
  - Formula: `effective = median + scale * (base - median) + bias`
  - Bias: Global deck offset (-40% to +40%)
  - Scale: Priority range compression/expansion (0.5x to 3.0x)
- **ArrayPriorityManager**: Reliable array-based ordering system
  - Uses array indices instead of floating-point priorities
  - Optimized for large card collections with O(1) lookups

### Recent Bug Fixes

#### Daily Review Limit + Global Mixed Mode Bug (2025-01-06)
- **Problem**: Daily Review Limit causing "Continue Cramming" display in global mixed mode
- **Root cause**: Logic in `PracticeOverlay.tsx:144-152` only considered current selected deck
- **Fix**: Different completion logic for global mixed vs single deck modes
- **Location**: `src/components/overlay/PracticeOverlay.tsx:144-152`

#### Mobile Layout Compatibility
- **Problem**: Duplicate container insertion on mobile devices
- **Fix**: Container deduplication logic in `src/extension.tsx`
- **Prevention**: DOM uniqueness checks during initialization

## Current Performance Issues & Requirements (2025-01-10)

### 🎯 Core Problem: "首屏秒开" (Instant First Screen Opening)
**User Requirement**: When user clicks the plugin button, the main window should appear **instantly** with a loading interface, instead of the current behavior where clicking the button causes 2-3 seconds of freezing before any interface appears.

#### Root Cause Analysis
- **NOT** a React rendering performance issue
- **IS** a main thread blocking issue: `onShowPracticeOverlay` → `refreshData` → `fetchPracticeData` triggers massive synchronous `window.roamAlphaAPI.q` queries
- These Roam API queries are synchronous and block the main thread, preventing browser from rendering the loading interface

#### Current Problematic Flow
1. User clicks button
2. **2-3 seconds of complete UI freeze** (main thread blocked by sync Roam queries)
3. Loading interface appears
4. Data loads and shows main content

#### Target Flow
1. User clicks button
2. **Loading interface appears immediately** (within ~50ms)
3. Data loads asynchronously in background
4. Loading interface replaced with main content

### 🔧 Required Solution Components

#### 1. Immediate UI Response
- Main window/dialog must appear instantly on button click
- Simple loading indicator (spinner + "正在准备复习..." text)
- No complex progress bars (they cause more problems than they solve)

#### 2. Asynchronous Data Loading
- Move all `window.roamAlphaAPI.q` queries out of the synchronous UI opening path
- Use `setTimeout(..., 0)` or similar to defer heavy data operations to next event loop
- Maintain existing data loading logic, just make it non-blocking

#### 3. Loading States Management
- **LoadingShell**: Immediate lightweight loading interface (like SavingShell style)
- **PracticeOverlay**: Shows data when ready, or internal loading state if needed
- Clean transition from loading to content

#### 4. Closing Performance
- Similar pattern for closing: immediate UI response for saving operations
- **SavingShell**: Simple spinner during save operations
- Async save operations to prevent blocking

### 🚫 What NOT to Do (Lessons Learned)
- **NO complex progress bars** - they cause timing issues and break normal functionality
- **NO batch processing with yielding** - over-engineering that introduces bugs
- **NO complex React rendering optimizations** - the problem is not React performance
- **NO "面多了加水，水多了加面"** - must solve systematically, not create new problems

### 📋 Implementation Strategy
1. **Create simple LoadingShell + SavingShell components** (spinner + text only)
2. **Modify app.tsx opening flow**: show LoadingShell immediately, defer data loading
3. **Keep PracticeOverlay simple**: show when data is ready
4. **Maintain all existing functionality**: priority management, saving, etc.
5. **Test thoroughly**: ensure no regressions in card loading, saving, or normal operations

### ✅ Implemented Solution (2025-01-10) - Final Version

#### Architecture
**Single Dialog + Content Switching** system for seamless user experience:

1. **UnifiedDialog** (`src/components/UnifiedDialog.tsx`):
   - Single Blueprint Dialog that manages all UI states
   - Eliminates animation conflicts between multiple dialogs
   - Provides consistent styling and responsive behavior

2. **LoadingShell** (`src/components/LoadingShell.tsx`):
   - Pure content component (no Dialog wrapper)
   - Simple spinner + "正在准备复习..." text
   - Appears instantly on button click

3. **PracticeOverlay** (`src/components/overlay/PracticeOverlay.tsx`):
   - Pure content component (Dialog wrapper removed)
   - Main content interface, shows when data is ready
   - All existing functionality maintained

4. **SavingShell** (`src/components/SavingShell.tsx`):
   - Pure content component (no Dialog wrapper)
   - Simple spinner + "正在保存进度..." text
   - Force close button for emergency situations

### 🚀 Performance Optimizations (Latest)

#### Global Performance Monitoring 
**Problem**: Plugin causing performance issues in normal Roam usage, including input lag when creating double brackets and CPU overheating on M4 MacBooks.

**Root Causes Identified & Fixed**:

1. **Global Block Interaction Monitoring** (Highest Impact):
   - **Issue**: `useOnBlockInteract` always running, monitoring all DOM textarea creation/destruction via Arrive.js
   - **Fix**: Conditional activation only when practice window is open (`enabled: dialogState === 'practice'`)
   - **Impact**: Eliminates input lag during normal Roam usage

2. **Reference List Collapse Feature**:
   - **Issue**: `useCollapseReferenceList` continuously monitoring DOM changes globally
   - **Fix**: Temporarily disabled to avoid global performance impact
   - **Status**: Feature disabled via comment in `src/app.tsx:169`

3. **Priority Manager Optimization**:
   - **Issue**: Priority management running continuously even when plugin closed
   - **Fix**: Conditional activation only when plugin windows are open (`isEnabled: dialogState !== 'closed'`)

4. **Page Visibility Optimization**:
   - **Issue**: Data refreshing on every page visibility change
   - **Fix**: Conditional refresh only when plugin windows are actually open

#### Data Loading Performance
**Problem**: CPU overheating during data loading, especially with large card collections.

**Solutions Implemented**:

1. **Batch Query Processing** (`src/queries/data.ts`):
   - Implemented `getBatchSessionData` for concurrent tag data loading
   - Replaces sequential per-tag queries with batched operations
   - Reduces database query count from O(n×3) to O(2) where n = number of tags

2. **Staged Loading Process** (`src/app.tsx`):
   - Phase 1: Immediate loading interface display
   - Phase 2: Background cache data loading (10ms delay)
   - Phase 3: Full practice data loading (20ms delay total)
   - Prevents UI blocking while maintaining data integrity

3. **Memory Management**:
   - Strategic use of `useRef` for large objects to prevent re-renders
   - Manual garbage collection suggestions (`window.gc()`) on plugin close
   - Debounced priority calculations to prevent excessive computation

#### Implementation Flow

**State Management** (`src/app.tsx`):
```typescript
type DialogState = 'closed' | 'loading' | 'practice' | 'saving';
const [dialogState, setDialogState] = React.useState<DialogState>('closed');
```

**Opening Flow**:
```typescript
const onShowPracticeOverlay = () => {
  // 1. 立即显示加载界面
  setDialogState('loading');
  setIsCramming(false);
  
  // 2. 异步加载数据并切换到主界面
  setTimeout(() => {
    refreshData();
    setDialogState('practice');
  }, 0);
};
```

**Closing Flow**:
```typescript
const onClosePracticeOverlayCallback = () => {
  // 1. 立即切换到保存界面
  setDialogState('saving');
  setIsCramming(false);
  
  // 2. 异步保存数据
  setTimeout(() => {
    refreshData();
    setDialogState('closed');
  }, 500);
};
```

**Unified Rendering**:
```typescript
<UnifiedDialog isOpen={dialogState !== 'closed'} onClose={onClosePracticeOverlayCallback}>
  {dialogState === 'loading' && <LoadingShell onClose={onClosePracticeOverlayCallback} />}
  {dialogState === 'saving' && <SavingShell onForceClose={() => setDialogState('closed')} />}
  {dialogState === 'practice' && <PracticeOverlay ... />}
</UnifiedDialog>
```

#### Key Design Principles
- **Single Dialog Architecture**: Eliminates animation conflicts completely
- **Content Switching**: Instant state transitions without re-mounting dialogs
- **Immediate UI Response**: LoadingShell appears instantly (< 50ms)
- **Async Data Operations**: Heavy Roam API queries moved out of sync UI path
- **Simple State Management**: Four clear states with seamless transitions
- **No Animation Conflicts**: Only one Dialog handles all transitions
- **Maintain Functionality**: All existing features preserved

#### Root Cause Resolution
The "white flash" was caused by **Blueprint Dialog animation conflicts**:
- Previous: LoadingShell Dialog (fade-out) + PracticeOverlay Dialog (fade-in) = overlap/flash
- Current: Single UnifiedDialog + content switching = seamless transitions

### 🎮 Success Criteria Status
- [x] Button click → Loading interface appears within 50ms
- [x] No "continue cramming" errors (card data loads correctly)
- [x] All existing functionality works (save, priority, mixed mode, etc.)
- [x] Clean code without over-engineering
- [x] No multiple loading interfaces or animation glitches
- [x] No input lag during normal Roam usage (block interaction monitoring disabled when plugin closed)
- [x] CPU usage optimization (batch processing, conditional feature activation)

## Critical Performance Considerations

### When Making Changes
**Always test performance impact on normal Roam usage**:
1. **Test double bracket creation speed** - Should have no lag when plugin window is closed
2. **Monitor CPU usage** - Check Activity Monitor during data loading operations
3. **Verify conditional hooks** - Ensure performance-sensitive hooks only run when needed

### Disabled Features for Performance
- **Reference List Collapse** (`useCollapseReferenceList`): Disabled in `src/app.tsx:169`
- **Block Interaction Monitoring**: Only active during practice sessions
- **Priority Manager**: Only active when plugin windows are open
- **Page Visibility Refresh**: Only when plugin windows are open

### Hook Performance Guidelines
- `useOnBlockInteract`: Must be conditionally enabled with `enabled` parameter
- `usePriorityManager`: Must check `isEnabled: dialogState !== 'closed'`
- `useOnVisibilityStateChange`: Should early return if `dialogState === 'closed'`
- Memory-intensive hooks should use `useRef` for large objects to prevent re-renders

### Database Query Optimization
- Batch operations instead of individual queries per tag/card
- Use `setTimeout(..., 0)` to yield main thread during heavy operations
- Implement debouncing for frequent operations (priority updates, data saves)
- Test with large card collections (1000+ cards) to verify performance