import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const pieceRank = {
  small: 1,
  medium: 2,
  large: 3,
}

const sizeOrder = ['small', 'medium', 'large']
const defaultGameMessage = 'Choose a size, then place it on the board.'
const roomCodePattern = /^[A-Z0-9]{6}$/
const roomCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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

function buildRoomCode() {
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    const randomIndex = Math.floor(Math.random() * roomCodeAlphabet.length)
    code += roomCodeAlphabet[randomIndex]
  }
  return code
}

function computeNextGameState(currentState, squareIndex) {
  const {
    board,
    pieces,
    currentPlayer,
    selectedSize,
    winner,
    isDraw,
  } = currentState

  if (winner || isDraw) {
    return { error: 'The game is already finished.' }
  }

  const currentAvailableSize = getFirstAvailableSize(pieces, currentPlayer)

  if (!currentAvailableSize) {
    return { error: `Player ${currentPlayer} has no pieces left.` }
  }

  const sizeToPlay =
    pieces[currentPlayer][selectedSize] > 0 ? selectedSize : currentAvailableSize

  if (!canPlacePiece(board, squareIndex, sizeToPlay)) {
    return {
      error:
        'Invalid placement: your new piece must be larger than the top piece on that square.',
    }
  }

  const nextBoard = placePiece(board, squareIndex, currentPlayer, sizeToPlay)
  const nextPieces = {
    ...pieces,
    [currentPlayer]: {
      ...pieces[currentPlayer],
      [sizeToPlay]: pieces[currentPlayer][sizeToPlay] - 1,
    },
  }

  const foundWinner = checkWinner(nextBoard)
  if (foundWinner) {
    return {
      nextState: {
        board: nextBoard,
        pieces: nextPieces,
        currentPlayer,
        selectedSize: sizeToPlay,
        winner: foundWinner,
        isDraw: false,
        message: `Player ${foundWinner} wins!`,
      },
    }
  }

  const otherPlayer = currentPlayer === 'X' ? 'O' : 'X'
  const otherPlayerHasMove = hasAnyLegalMove(nextBoard, nextPieces, otherPlayer)
  const currentPlayerHasMove = hasAnyLegalMove(nextBoard, nextPieces, currentPlayer)

  if (!otherPlayerHasMove && !currentPlayerHasMove) {
    return {
      nextState: {
        board: nextBoard,
        pieces: nextPieces,
        currentPlayer,
        selectedSize: sizeToPlay,
        winner: null,
        isDraw: true,
        message: 'No legal moves left for either player. Draw.',
      },
    }
  }

  if (!otherPlayerHasMove && currentPlayerHasMove) {
    const fallbackSize =
      nextPieces[currentPlayer][sizeToPlay] > 0
        ? sizeToPlay
        : getFirstAvailableSize(nextPieces, currentPlayer)

    return {
      nextState: {
        board: nextBoard,
        pieces: nextPieces,
        currentPlayer,
        selectedSize: fallbackSize ?? sizeToPlay,
        winner: null,
        isDraw: false,
        message: `Player ${otherPlayer} has no legal move. Player ${currentPlayer} goes again.`,
      },
    }
  }

  const fallbackSize =
    nextPieces[otherPlayer][sizeToPlay] > 0
      ? sizeToPlay
      : getFirstAvailableSize(nextPieces, otherPlayer)

  return {
    nextState: {
      board: nextBoard,
      pieces: nextPieces,
      currentPlayer: otherPlayer,
      selectedSize: fallbackSize ?? sizeToPlay,
      winner: null,
      isDraw: false,
      message: `Player ${otherPlayer}'s turn.`,
    },
  }
}

function App() {
  const [board, setBoard] = useState(() => createInitialBoard())
  const [pieces, setPieces] = useState(() => createInitialPieces())
  const [currentPlayer, setCurrentPlayer] = useState('X')
  const [selectedSize, setSelectedSize] = useState('small')
  const [winner, setWinner] = useState(null)
  const [isDraw, setIsDraw] = useState(false)
  const [message, setMessage] = useState(defaultGameMessage)

  const [isAuthReady, setIsAuthReady] = useState(false)
  const [authUserId, setAuthUserId] = useState(null)

  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [activeRoomCode, setActiveRoomCode] = useState('')
  const [playerSymbol, setPlayerSymbol] = useState(null)
  const [roomStatus, setRoomStatus] = useState('idle')
  const [roomPlayers, setRoomPlayers] = useState([])
  const [roomUpdatedAt, setRoomUpdatedAt] = useState(null)
  const [roomMessage, setRoomMessage] = useState(
    isSupabaseConfigured
      ? 'Create a room, then join it from another device using the room code.'
      : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable multiplayer.',
  )
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [isJoiningRoom, setIsJoiningRoom] = useState(false)
  const [isLeavingRoom, setIsLeavingRoom] = useState(false)

  const hasBootstrappedAuthRef = useRef(false)
  const roomChannelRef = useRef(null)

  const currentAvailableSize = useMemo(
    () => getFirstAvailableSize(pieces, currentPlayer),
    [pieces, currentPlayer],
  )

  const previewSize =
    pieces[currentPlayer][selectedSize] > 0 ? selectedSize : currentAvailableSize

  const inRoom = Boolean(activeRoomId)
  const waitingForOpponent = inRoom && roomPlayers.length < 2
  const isPlayersTurn = !inRoom || (playerSymbol && playerSymbol === currentPlayer)

  const applyGameState = useCallback((nextState) => {
    setBoard(nextState.board)
    setPieces(nextState.pieces)
    setCurrentPlayer(nextState.currentPlayer)
    setSelectedSize(nextState.selectedSize)
    setWinner(nextState.winner)
    setIsDraw(nextState.isDraw)
    setMessage(nextState.message)
  }, [])

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

  const fetchRoomPlayers = useCallback(async (roomId) => {
    if (!isSupabaseConfigured || !supabase || !roomId) return []

    const { data, error } = await supabase
      .from('room_players')
      .select('room_id, user_id, symbol, joined_at')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    if (error) {
      throw error
    }

    const playersList = data ?? []
    setRoomPlayers(playersList)
    return playersList
  }, [])

  const applyRoomRow = useCallback(
    (roomRow) => {
      if (!roomRow) return

      if (roomRow.updated_at) {
        setRoomUpdatedAt(roomRow.updated_at)
      }

      if (typeof roomRow.status === 'string') {
        setRoomStatus(roomRow.status)
      }

      if (typeof roomRow.room_code === 'string') {
        setActiveRoomCode(roomRow.room_code)
      }

      try {
        const parsedState = normalizeLoadedState(roomRow.game_state)
        applyGameState(parsedState)
      } catch (error) {
        const details = error instanceof Error ? error.message : 'Invalid room state.'
        setRoomMessage(`Room sync failed: ${details}`)
      }
    },
    [applyGameState],
  )

  const syncRoomFromServer = useCallback(
    async (roomId) => {
      if (!isSupabaseConfigured || !supabase || !roomId) return

      const { data, error } = await supabase
        .from('game_rooms')
        .select('id, room_code, game_state, status, updated_at')
        .eq('id', roomId)
        .limit(1)

      if (error) {
        throw error
      }

      const roomRow = data?.[0]
      if (!roomRow) {
        throw new Error('Room no longer exists or is inaccessible.')
      }

      applyRoomRow(roomRow)
      await fetchRoomPlayers(roomId)
    },
    [applyRoomRow, fetchRoomPlayers],
  )

  async function updateRoomStatusIfNeeded(roomId, playerCount, status) {
    if (!isSupabaseConfigured || !supabase || !roomId) return

    if (status === 'finished') return

    const desiredStatus = playerCount >= 2 ? 'active' : 'waiting'

    if (status === desiredStatus) return

    await supabase
      .from('game_rooms')
      .update({ status: desiredStatus })
      .eq('id', roomId)
  }

  function leaveRoomLocal() {
    setActiveRoomId(null)
    setActiveRoomCode('')
    setPlayerSymbol(null)
    setRoomStatus('idle')
    setRoomPlayers([])
    setRoomUpdatedAt(null)
    setRoomMessage('Create a room, then join it from another device using the room code.')
  }

  async function leaveRoom() {
    if (!isSupabaseConfigured || !supabase || !inRoom || !authUserId) {
      leaveRoomLocal()
      applyGameState(createInitialGameState())
      return
    }

    const roomId = activeRoomId

    try {
      setIsLeavingRoom(true)

      await supabase
        .from('room_players')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', authUserId)

      const { data: playersAfter } = await supabase
        .from('room_players')
        .select('room_id, user_id, symbol')
        .eq('room_id', roomId)

      const remaining = playersAfter?.length ?? 0

      if (remaining === 0) {
        await supabase.from('game_rooms').delete().eq('id', roomId)
      } else {
        await updateRoomStatusIfNeeded(roomId, remaining, roomStatus)
      }

      leaveRoomLocal()
      applyGameState(createInitialGameState())
      setMessage(defaultGameMessage)
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error'
      setRoomMessage(`Leave room failed: ${details}`)
    } finally {
      setIsLeavingRoom(false)
    }
  }

  async function createRoom() {
    if (!isSupabaseConfigured || !supabase || !isAuthReady || !authUserId) return

    try {
      setIsCreatingRoom(true)

      let roomRow = null
      let insertError = null

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const roomCode = buildRoomCode()
        const { data, error } = await supabase
          .from('game_rooms')
          .insert({
            room_code: roomCode,
            host_user_id: authUserId,
            game_state: createInitialGameState(),
            status: 'waiting',
          })
          .select('id, room_code, game_state, status, updated_at')
          .single()

        if (!error) {
          roomRow = data
          break
        }

        insertError = error

        if (error.code !== '23505') {
          break
        }
      }

      if (!roomRow) {
        throw insertError ?? new Error('Could not create room.')
      }

      const { error: playerError } = await supabase.from('room_players').insert({
        room_id: roomRow.id,
        user_id: authUserId,
        symbol: 'X',
      })

      if (playerError) {
        throw playerError
      }

      setActiveRoomId(roomRow.id)
      setActiveRoomCode(roomRow.room_code)
      setPlayerSymbol('X')
      setRoomStatus(roomRow.status)
      setRoomUpdatedAt(roomRow.updated_at)
      applyRoomRow(roomRow)
      await fetchRoomPlayers(roomRow.id)
      setRoomMessage(`Room ${roomRow.room_code} created. Share this code with Player O.`)
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error'
      setRoomMessage(`Create room failed: ${details}`)
    } finally {
      setIsCreatingRoom(false)
    }
  }

  async function joinRoom() {
    if (!isSupabaseConfigured || !supabase || !isAuthReady || !authUserId) return

    const normalizedCode = roomCodeInput.trim().toUpperCase()

    if (!roomCodePattern.test(normalizedCode)) {
      setRoomMessage('Enter a valid 6-character room code.')
      return
    }

    try {
      setIsJoiningRoom(true)

      const { data: roomRows, error: roomError } = await supabase
        .from('game_rooms')
        .select('id, room_code, game_state, status, updated_at')
        .eq('room_code', normalizedCode)
        .limit(1)

      if (roomError) {
        throw roomError
      }

      const roomRow = roomRows?.[0]

      if (!roomRow) {
        setRoomMessage('Room not found.')
        return
      }

      let playersList = await fetchRoomPlayers(roomRow.id)

      const existingPlayer = playersList.find((player) => player.user_id === authUserId)

      let symbolToUse = existingPlayer?.symbol ?? null

      if (!symbolToUse) {
        if (playersList.length >= 2) {
          setRoomMessage('This room already has two players.')
          return
        }

        const usedSymbols = new Set(playersList.map((player) => player.symbol))
        symbolToUse = usedSymbols.has('X') ? 'O' : 'X'

        const { error: joinError } = await supabase.from('room_players').insert({
          room_id: roomRow.id,
          user_id: authUserId,
          symbol: symbolToUse,
        })

        if (joinError) {
          throw joinError
        }

        playersList = await fetchRoomPlayers(roomRow.id)
      }

      await updateRoomStatusIfNeeded(roomRow.id, playersList.length, roomRow.status)

      setActiveRoomId(roomRow.id)
      setActiveRoomCode(roomRow.room_code)
      setPlayerSymbol(symbolToUse)
      applyRoomRow(roomRow)
      await syncRoomFromServer(roomRow.id)

      setRoomMessage(`Joined room ${roomRow.room_code} as Player ${symbolToUse}.`)
      setRoomCodeInput('')
    } catch (error) {
      const details = error instanceof Error ? error.message : 'Unknown error'
      setRoomMessage(`Join failed: ${details}`)
    } finally {
      setIsJoiningRoom(false)
    }
  }

  async function pushRoomState(nextState, nextStatus) {
    if (!isSupabaseConfigured || !supabase || !activeRoomId) {
      return { ok: false, error: 'Room is not connected.' }
    }

    const updatePayload = {
      game_state: nextState,
      status: nextStatus,
    }

    let query = supabase
      .from('game_rooms')
      .update(updatePayload)
      .eq('id', activeRoomId)
      .select('id, room_code, game_state, status, updated_at')
      .single()

    if (roomUpdatedAt) {
      query = query.eq('updated_at', roomUpdatedAt)
    }

    const { data, error } = await query

    if (error) {
      return { ok: false, error: error.message }
    }

    if (!data) {
      return { ok: false, error: 'Room update conflict. Please try again.' }
    }

    applyRoomRow(data)
    return { ok: true }
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || hasBootstrappedAuthRef.current) return
    hasBootstrappedAuthRef.current = true

    let isCancelled = false

    async function initializeAuth() {
      try {
        setRoomMessage('Connecting to Supabase...')
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
        setIsAuthReady(true)
        setRoomMessage('Create a room, then join it from another device using the room code.')
      } catch (error) {
        if (isCancelled) return
        const details = error instanceof Error ? error.message : 'Unknown error'
        setRoomMessage(`Multiplayer setup failed: ${details}`)
      }
    }

    initializeAuth()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !activeRoomId) return

    let isCancelled = false

    async function connectRoomRealtime() {
      try {
        await syncRoomFromServer(activeRoomId)
        if (isCancelled) return

        if (roomChannelRef.current) {
          await supabase.removeChannel(roomChannelRef.current)
          roomChannelRef.current = null
        }

        const channel = supabase
          .channel(`room-${activeRoomId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'game_rooms',
              filter: `id=eq.${activeRoomId}`,
            },
            async (payload) => {
              if (isCancelled) return
              const roomRow = payload.new
              applyRoomRow(roomRow)
              await fetchRoomPlayers(activeRoomId)
            },
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'room_players',
              filter: `room_id=eq.${activeRoomId}`,
            },
            async () => {
              if (isCancelled) return
              const latestPlayers = await fetchRoomPlayers(activeRoomId)
              setRoomStatus((currentStatus) => {
                if (currentStatus === 'finished') return currentStatus
                return latestPlayers.length >= 2 ? 'active' : 'waiting'
              })
            },
          )

        channel.subscribe((status) => {
          if (isCancelled) return

          if (status === 'SUBSCRIBED') {
            setRoomMessage((currentMessage) => {
              if (currentMessage.startsWith('Create a room')) {
                return 'Room connected.'
              }
              return currentMessage
            })
          }

          if (status === 'CHANNEL_ERROR') {
            setRoomMessage('Room realtime channel error. Refreshing room state...')
            syncRoomFromServer(activeRoomId).catch(() => {
              setRoomMessage('Room sync failed after channel error.')
            })
          }
        })

        roomChannelRef.current = channel
      } catch (error) {
        if (isCancelled) return
        const details = error instanceof Error ? error.message : 'Unknown error'
        setRoomMessage(`Room connection failed: ${details}`)
      }
    }

    connectRoomRealtime()

    return () => {
      isCancelled = true
      if (roomChannelRef.current) {
        supabase.removeChannel(roomChannelRef.current)
        roomChannelRef.current = null
      }
    }
  }, [activeRoomId, applyRoomRow, fetchRoomPlayers, syncRoomFromServer])

  function handleSelectSize(size) {
    if (winner || isDraw) return

    if (inRoom && !isPlayersTurn) {
      setRoomMessage(`It is Player ${currentPlayer}'s turn.`)
      return
    }

    if (pieces[currentPlayer][size] <= 0) {
      setMessage(`Player ${currentPlayer} is out of ${size} pieces.`)
      return
    }

    setSelectedSize(size)
  }

  async function handleSquareClick(squareIndex) {
    if (winner || isDraw) return

    if (inRoom) {
      if (!playerSymbol) {
        setRoomMessage('Room role is not ready yet.')
        return
      }

      if (waitingForOpponent) {
        setRoomMessage('Waiting for another player to join the room.')
        return
      }

      if (!isPlayersTurn) {
        setRoomMessage(`It is Player ${currentPlayer}'s turn.`)
        return
      }
    }

    const computed = computeNextGameState(readCurrentGameState(), squareIndex)

    if (computed.error) {
      setMessage(computed.error)
      return
    }

    const nextState = computed.nextState

    if (!inRoom) {
      applyGameState(nextState)
      return
    }

    const nextStatus = nextState.winner || nextState.isDraw ? 'finished' : 'active'
    const updateResult = await pushRoomState(nextState, nextStatus)

    if (!updateResult.ok) {
      setRoomMessage(`Move failed: ${updateResult.error}`)
      await syncRoomFromServer(activeRoomId)
      return
    }

    setRoomMessage(`Move played as Player ${playerSymbol}.`)
  }

  async function handleResetGame() {
    if (!inRoom) {
      applyGameState(createInitialGameState())
      return
    }

    if (playerSymbol !== 'X') {
      setRoomMessage('Only Player X can reset the room game.')
      return
    }

    const resetState = createInitialGameState()
    const nextStatus = roomPlayers.length >= 2 ? 'active' : 'waiting'

    const updateResult = await pushRoomState(resetState, nextStatus)
    if (!updateResult.ok) {
      setRoomMessage(`Reset failed: ${updateResult.error}`)
      return
    }

    setRoomMessage('Room game reset.')
  }

  const statusText = winner
    ? `Winner: Player ${winner}`
    : isDraw
      ? 'Draw'
      : `Turn: Player ${currentPlayer}`

  const roomPlayersSummary = roomPlayers
    .map((player) => {
      const selfTag = player.user_id === authUserId ? ' (you)' : ''
      return `${player.symbol}${selfTag}`
    })
    .join(' vs ')

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
                    disabled={winner || isDraw || (inRoom && !isPlayersTurn)}
                  >
                    <span>{size}</span>
                    <span className="remaining">{remaining}</span>
                    {out && <span className="sold-out">out</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <button type="button" className="reset" onClick={handleResetGame}>
            {inRoom ? 'Reset Room Game' : 'Reset Game'}
          </button>

          <div className="room-panel">
            <h3>Multiplayer Room</h3>
            <p className="cloud-message">{roomMessage}</p>

            {inRoom ? (
              <>
                <div className="room-meta">
                  <span>Room Code</span>
                  <code>{activeRoomCode}</code>
                </div>
                <div className="room-meta">
                  <span>Your Role</span>
                  <code>{playerSymbol ?? '—'}</code>
                </div>
                <div className="room-meta">
                  <span>Room Status</span>
                  <code>{roomStatus}</code>
                </div>
                <div className="room-meta">
                  <span>Players</span>
                  <code>{roomPlayersSummary || 'Waiting...'}</code>
                </div>

                <button
                  type="button"
                  className="cloud-button danger"
                  onClick={leaveRoom}
                  disabled={isLeavingRoom}
                >
                  {isLeavingRoom ? 'Leaving...' : 'Leave Room'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="cloud-button"
                  onClick={createRoom}
                  disabled={!isAuthReady || isCreatingRoom}
                >
                  {isCreatingRoom ? 'Creating...' : 'Create Room (Player X)'}
                </button>

                <label className="field-label" htmlFor="roomCodeInput">
                  Join Room Code
                </label>
                <input
                  id="roomCodeInput"
                  className="cloud-input"
                  value={roomCodeInput}
                  onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  disabled={!isAuthReady}
                />

                <button
                  type="button"
                  className="cloud-button secondary"
                  onClick={joinRoom}
                  disabled={!isAuthReady || isJoiningRoom}
                >
                  {isJoiningRoom ? 'Joining...' : 'Join Room'}
                </button>
              </>
            )}
          </div>
        </aside>

        <section className="board" aria-label="Tic-Tac-Stack board">
          {board.map((stack, index) => {
            const topPiece = stack[stack.length - 1] ?? null
            const playable =
              !winner &&
              !isDraw &&
              previewSize &&
              canPlacePiece(board, index, previewSize) &&
              (!inRoom || (isPlayersTurn && !waitingForOpponent))

            return (
              <button
                key={index}
                type="button"
                className={`square ${playable ? 'playable' : ''}`}
                onClick={() => handleSquareClick(index)}
                aria-label={`Square ${index + 1}`}
                disabled={!playable}
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
