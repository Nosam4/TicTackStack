import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const pieceRank = {
  small: 1,
  medium: 2,
  large: 3,
}

const sizeOrder = ['small', 'medium', 'large']
const defaultGameMessage = 'Choose a size, then place it on the board.'

function createInitialBoard() {
  return Array.from({ length: 9 }, () => [])
}

function createInitialPieces() {
  return {
    X: {
      small: 4,
      medium: 2,
      large: 2,
    },
    O: {
      small: 4,
      medium: 2,
      large: 2,
    },
  }
}

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

function canPlacePiece(board, squareIndex, selectedSize) {
  const stack = board[squareIndex]

  if (stack.length === 0) return true

  const topPiece = stack[stack.length - 1]
  return pieceRank[selectedSize] > pieceRank[topPiece.size]
}

function placePiece(board, squareIndex, player, size) {
  if (!canPlacePiece(board, squareIndex, size)) {
    return board
  }

  return board.map((stack, index) => {
    if (index !== squareIndex) return stack
    return [...stack, { player, size }]
  })
}

function getVisibleBoard(board) {
  return board.map((stack) => {
    if (stack.length === 0) return null
    return stack[stack.length - 1].player
  })
}

function checkWinner(board) {
  const visibleBoard = getVisibleBoard(board)

  for (const [a, b, c] of winningLines) {
    if (
      visibleBoard[a] &&
      visibleBoard[a] === visibleBoard[b] &&
      visibleBoard[a] === visibleBoard[c]
    ) {
      return visibleBoard[a]
    }
  }

  return null
}

function hasAnyLegalMove(board, pieces, player) {
  return sizeOrder.some((size) => {
    if (pieces[player][size] <= 0) return false
    return board.some((_, index) => canPlacePiece(board, index, size))
  })
}

function getFirstAvailableSize(pieces, player) {
  return sizeOrder.find((size) => pieces[player][size] > 0) ?? null
}

function createInitialGameState() {
  return {
    board: createInitialBoard(),
    pieces: createInitialPieces(),
    currentPlayer: 'X',
    selectedSize: 'small',
    winner: null,
    isDraw: false,
    message: defaultGameMessage,
  }
}

function isValidPlayer(player) {
  return player === 'X' || player === 'O'
}

function normalizeLoadedState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    throw new Error('Saved data is invalid.')
  }

  const {
    board,
    pieces,
    currentPlayer,
    selectedSize,
    winner,
    isDraw,
    message,
  } = rawState

  if (!Array.isArray(board) || board.length !== 9) {
    throw new Error('Saved board is invalid.')
  }

  if (!pieces || typeof pieces !== 'object' || !pieces.X || !pieces.O) {
    throw new Error('Saved piece inventory is invalid.')
  }

  if (!isValidPlayer(currentPlayer)) {
    throw new Error('Saved current player is invalid.')
  }

  if (!sizeOrder.includes(selectedSize)) {
    throw new Error('Saved selected size is invalid.')
  }

  if (winner !== null && !isValidPlayer(winner)) {
    throw new Error('Saved winner value is invalid.')
  }

  if (typeof isDraw !== 'boolean') {
    throw new Error('Saved draw value is invalid.')
  }

  return {
    board,
    pieces,
    currentPlayer,
    selectedSize,
    winner,
    isDraw,
    message: typeof message === 'string' ? message : defaultGameMessage,
  }
}

function buildSaveOptions(saves) {
  return saves.map((save) => {
    const updated = save.updated_at ? new Date(save.updated_at) : null
    const timestamp =
      updated && !Number.isNaN(updated.getTime())
        ? updated.toLocaleString()
        : 'Unknown time'

    return {
      ...save,
      label: `${save.name} (${timestamp})`,
    }
  })
}

function App() {
  const [board, setBoard] = useState(() => createInitialBoard())
  const [pieces, setPieces] = useState(() => createInitialPieces())
  const [currentPlayer, setCurrentPlayer] = useState('X')
  const [selectedSize, setSelectedSize] = useState('small')
  const [winner, setWinner] = useState(null)
  const [isDraw, setIsDraw] = useState(false)
  const [message, setMessage] = useState(defaultGameMessage)

  const [saveName, setSaveName] = useState('My Match')
  const [saves, setSaves] = useState([])
  const [selectedSaveId, setSelectedSaveId] = useState('')
  const [cloudMessage, setCloudMessage] = useState(
    isSupabaseConfigured
      ? 'Preparing cloud saves...'
      : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud saves.',
  )
  const [isCloudReady, setIsCloudReady] = useState(false)
  const [authUserId, setAuthUserId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingSave, setIsLoadingSave] = useState(false)
  const [isDeletingSave, setIsDeletingSave] = useState(false)
  const [isFetchingSaves, setIsFetchingSaves] = useState(false)

  const hasBootstrappedCloudRef = useRef(false)

  const currentAvailableSize = useMemo(
    () => getFirstAvailableSize(pieces, currentPlayer),
    [pieces, currentPlayer],
  )

  const previewSize =
    pieces[currentPlayer][selectedSize] > 0 ? selectedSize : currentAvailableSize

  function applyGameState(nextState) {
    setBoard(nextState.board)
    setPieces(nextState.pieces)
    setCurrentPlayer(nextState.currentPlayer)
    setSelectedSize(nextState.selectedSize)
    setWinner(nextState.winner)
    setIsDraw(nextState.isDraw)
    setMessage(nextState.message)
  }

  function readCurrentGameState() {
    return {
      board,
      pieces,
      currentPlayer,
      selectedSize,
      winner,
      isDraw,
      message,
    }
  }

  async function fetchCloudSaves() {
    if (!isSupabaseConfigured || !supabase) return []

    setIsFetchingSaves(true)

    const { data, error } = await supabase
      .from('game_saves')
      .select('id, name, updated_at')
      .order('updated_at', { ascending: false })

    setIsFetchingSaves(false)

    if (error) {
      throw error
    }

    const normalized = buildSaveOptions(data ?? [])
    setSaves(normalized)

    if (normalized.length === 0) {
      setSelectedSaveId('')
      return normalized
    }

    setSelectedSaveId((currentValue) => {
      if (currentValue && normalized.some((save) => save.id === currentValue)) {
        return currentValue
      }
      return normalized[0].id
    })

    return normalized
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || hasBootstrappedCloudRef.current) return
    hasBootstrappedCloudRef.current = true

    let isCancelled = false

    async function initializeCloudSaves() {
      try {
        setCloudMessage('Connecting to Supabase...')
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        let user = sessionData.session?.user ?? null

        if (!user) {
          const { data: signInData, error: signInError } =
            await supabase.auth.signInAnonymously()
          if (signInError) {
            throw signInError
          }
          user = signInData.user ?? signInData.session?.user ?? null
        }

        if (!user) {
          throw new Error('Supabase auth session could not be established.')
        }

        if (isCancelled) return

        setAuthUserId(user.id)
        setCloudMessage('Connected. Loading saves...')
        await fetchCloudSaves()
        if (isCancelled) return

        setIsCloudReady(true)
        setCloudMessage('Cloud saves ready.')
      } catch (error) {
        if (isCancelled) return
        const details = error instanceof Error ? error.message : 'Unknown error'
        setCloudMessage(`Cloud save setup failed: ${details}`)
      }
    }

    initializeCloudSaves()

    return () => {
      isCancelled = true
    }
  }, [])

  function resetGame() {
    applyGameState(createInitialGameState())
  }

  function handleSelectSize(size) {
    if (winner || isDraw) return
    if (pieces[currentPlayer][size] <= 0) {
      setMessage(`Player ${currentPlayer} is out of ${size} pieces.`)
      return
    }
    setSelectedSize(size)
  }

  function handleSquareClick(squareIndex) {
    if (winner || isDraw) return

    if (!currentAvailableSize) {
      setMessage(`Player ${currentPlayer} has no pieces left.`)
      return
    }

    const sizeToPlay =
      pieces[currentPlayer][selectedSize] > 0 ? selectedSize : currentAvailableSize

    if (!canPlacePiece(board, squareIndex, sizeToPlay)) {
      setMessage(
        'Invalid placement: your new piece must be larger than the top piece on that square.',
      )
      return
    }

    const nextBoard = placePiece(board, squareIndex, currentPlayer, sizeToPlay)
    const nextPieces = {
      ...pieces,
      [currentPlayer]: {
        ...pieces[currentPlayer],
        [sizeToPlay]: pieces[currentPlayer][sizeToPlay] - 1,
      },
    }

    setBoard(nextBoard)
    setPieces(nextPieces)

    const foundWinner = checkWinner(nextBoard)
    if (foundWinner) {
      setWinner(foundWinner)
      setMessage(`Player ${foundWinner} wins!`)
      return
    }

    const otherPlayer = currentPlayer === 'X' ? 'O' : 'X'
    const otherPlayerHasMove = hasAnyLegalMove(nextBoard, nextPieces, otherPlayer)
    const currentPlayerHasMove = hasAnyLegalMove(nextBoard, nextPieces, currentPlayer)

    if (!otherPlayerHasMove && !currentPlayerHasMove) {
      setIsDraw(true)
      setMessage('No legal moves left for either player. Draw.')
      return
    }

    if (!otherPlayerHasMove && currentPlayerHasMove) {
      const nextSelectedSize =
        nextPieces[currentPlayer][selectedSize] > 0
          ? selectedSize
          : getFirstAvailableSize(nextPieces, currentPlayer)

      if (nextSelectedSize) {
        setSelectedSize(nextSelectedSize)
      }
      setMessage(`Player ${otherPlayer} has no legal move. Player ${currentPlayer} goes again.`)
      return
    }

    setCurrentPlayer(otherPlayer)

    const nextSelectedSize =
      nextPieces[otherPlayer][selectedSize] > 0
        ? selectedSize
        : getFirstAvailableSize(nextPieces, otherPlayer)

    if (nextSelectedSize) {
      setSelectedSize(nextSelectedSize)
    }

    setMessage(`Player ${otherPlayer}'s turn.`)
  }

  async function saveToCloud() {
    if (!isSupabaseConfigured || !supabase || !isCloudReady || !authUserId) return

    const cleanedName = saveName.trim()
    if (!cleanedName) {
      setCloudMessage('Enter a save name before saving.')
      return
    }

    try {
      setIsSaving(true)

      const { error } = await supabase.from('game_saves').insert({
        user_id: authUserId,
        name: cleanedName,
        game_state: readCurrentGameState(),
      })

      if (error) {
        setCloudMessage(`Save failed: ${error.message}`)
        return
      }

      await fetchCloudSaves()
      setCloudMessage(`Saved "${cleanedName}" to cloud.`)
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error'
      setCloudMessage(`Save failed: ${details}`)
    } finally {
      setIsSaving(false)
    }
  }

  async function loadSelectedSave() {
    if (!isSupabaseConfigured || !supabase || !isCloudReady) return

    if (!selectedSaveId) {
      setCloudMessage('Select a save to load.')
      return
    }

    setIsLoadingSave(true)

    const { data, error } = await supabase
      .from('game_saves')
      .select('id, name, game_state')
      .eq('id', selectedSaveId)
      .single()

    setIsLoadingSave(false)

    if (error) {
      setCloudMessage(`Load failed: ${error.message}`)
      return
    }

    try {
      const nextState = normalizeLoadedState(data.game_state)
      applyGameState(nextState)
      setSaveName(data.name)
      setCloudMessage(`Loaded "${data.name}".`)
    } catch (validationError) {
      const details =
        validationError instanceof Error ? validationError.message : 'Invalid save format.'
      setCloudMessage(`Load failed: ${details}`)
    }
  }

  async function deleteSelectedSave() {
    if (!isSupabaseConfigured || !supabase || !isCloudReady) return

    if (!selectedSaveId) {
      setCloudMessage('Select a save to delete.')
      return
    }

    const saveToDelete = saves.find((save) => save.id === selectedSaveId)
    const deleteName = saveToDelete?.name ?? 'selected save'

    try {
      setIsDeletingSave(true)

      const { error } = await supabase
        .from('game_saves')
        .delete()
        .eq('id', selectedSaveId)

      if (error) {
        setCloudMessage(`Delete failed: ${error.message}`)
        return
      }

      await fetchCloudSaves()
      setCloudMessage(`Deleted "${deleteName}".`)
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error'
      setCloudMessage(`Delete failed: ${details}`)
    } finally {
      setIsDeletingSave(false)
    }
  }

  const statusText = winner
    ? `Winner: Player ${winner}`
    : isDraw
      ? 'Draw'
      : `Turn: Player ${currentPlayer}`

  const cloudDisabled = !isSupabaseConfigured || !isCloudReady

  return (
    <main className="app-shell">
      <header className="header">
        <p className="eyebrow">Stacked Strategy</p>
        <h1>Tic-Tac-Stack</h1>
        <p className="rule-note">
          Place only new pieces. You can stack onto a square only when your piece is larger than
          the top piece.
        </p>
      </header>

      <section className="game-layout">
        <aside className="panel left">
          <h2>{statusText}</h2>
          <p className="message">{message}</p>

          <div className="inventory">
            <h3>Pieces Left</h3>
            {['X', 'O'].map((player) => (
              <div key={player} className={`inventory-row ${player === currentPlayer ? 'active' : ''}`}>
                <strong>Player {player}</strong>
                <span>S: {pieces[player].small}</span>
                <span>M: {pieces[player].medium}</span>
                <span>L: {pieces[player].large}</span>
              </div>
            ))}
          </div>

          <div className="size-picker">
            <h3>Choose Size</h3>
            <div className="size-buttons">
              {sizeOrder.map((size) => {
                const remaining = pieces[currentPlayer][size]
                const selected = selectedSize === size
                const out = remaining <= 0
                return (
                  <button
                    key={size}
                    type="button"
                    className={`size-button ${size} ${selected ? 'selected' : ''}`}
                    onClick={() => handleSelectSize(size)}
                    disabled={winner || isDraw}
                  >
                    <span>{size}</span>
                    <span className="remaining">{remaining}</span>
                    {out && <span className="sold-out">out</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <button type="button" className="reset" onClick={resetGame}>
            Reset Game
          </button>

          <div className="cloud-saves">
            <h3>Cloud Saves</h3>
            <p className="cloud-message">{cloudMessage}</p>

            <label className="field-label" htmlFor="saveName">
              Save Name
            </label>
            <input
              id="saveName"
              className="cloud-input"
              value={saveName}
              onChange={(event) => setSaveName(event.target.value)}
              placeholder="Name this game state"
              disabled={!isSupabaseConfigured}
            />

            <button
              type="button"
              className="cloud-button"
              onClick={saveToCloud}
              disabled={cloudDisabled || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save to Cloud'}
            </button>

            <label className="field-label" htmlFor="savedGames">
              Saved Games
            </label>
            <select
              id="savedGames"
              className="cloud-select"
              value={selectedSaveId}
              onChange={(event) => setSelectedSaveId(event.target.value)}
              disabled={cloudDisabled || saves.length === 0 || isFetchingSaves}
            >
              {saves.length === 0 ? (
                <option value="">No saves yet</option>
              ) : (
                saves.map((save) => (
                  <option key={save.id} value={save.id}>
                    {save.label}
                  </option>
                ))
              )}
            </select>

            <div className="cloud-actions">
              <button
                type="button"
                className="cloud-button secondary"
                onClick={loadSelectedSave}
                disabled={cloudDisabled || !selectedSaveId || isLoadingSave}
              >
                {isLoadingSave ? 'Loading...' : 'Load'}
              </button>
              <button
                type="button"
                className="cloud-button danger"
                onClick={deleteSelectedSave}
                disabled={cloudDisabled || !selectedSaveId || isDeletingSave}
              >
                {isDeletingSave ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </aside>

        <section className="board" aria-label="Tic-Tac-Stack board">
          {board.map((stack, index) => {
            const topPiece = stack[stack.length - 1] ?? null
            const playable =
              !winner &&
              !isDraw &&
              previewSize &&
              canPlacePiece(board, index, previewSize)

            return (
              <button
                key={index}
                type="button"
                className={`square ${playable ? 'playable' : ''}`}
                onClick={() => handleSquareClick(index)}
                aria-label={`Square ${index + 1}`}
              >
                {topPiece ? (
                  <div className={`piece ${topPiece.player.toLowerCase()} ${topPiece.size}`}>
                    <span>{topPiece.player}</span>
                  </div>
                ) : (
                  <span className="empty-dot" aria-hidden="true"></span>
                )}
                {stack.length > 1 && <span className="stack-count">{stack.length}</span>}
              </button>
            )
          })}
        </section>
      </section>
    </main>
  )
}

export default App
