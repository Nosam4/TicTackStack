import { useMemo, useState } from 'react'
import './App.css'

const pieceRank = {
  small: 1,
  medium: 2,
  large: 3,
}

const sizeOrder = ['small', 'medium', 'large']

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

function App() {
  const [board, setBoard] = useState(() => createInitialBoard())
  const [pieces, setPieces] = useState(() => createInitialPieces())
  const [currentPlayer, setCurrentPlayer] = useState('X')
  const [selectedSize, setSelectedSize] = useState('small')
  const [winner, setWinner] = useState(null)
  const [isDraw, setIsDraw] = useState(false)
  const [message, setMessage] = useState('Choose a size, then place it on the board.')

  const currentAvailableSize = useMemo(
    () => getFirstAvailableSize(pieces, currentPlayer),
    [pieces, currentPlayer],
  )

  const previewSize =
    pieces[currentPlayer][selectedSize] > 0 ? selectedSize : currentAvailableSize

  function resetGame() {
    setBoard(createInitialBoard())
    setPieces(createInitialPieces())
    setCurrentPlayer('X')
    setSelectedSize('small')
    setWinner(null)
    setIsDraw(false)
    setMessage('Choose a size, then place it on the board.')
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

  const statusText = winner
    ? `Winner: Player ${winner}`
    : isDraw
      ? 'Draw'
      : `Turn: Player ${currentPlayer}`

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
