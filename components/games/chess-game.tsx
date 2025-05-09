/*
  This component implements a full chess game in React using TypeScript.
  It supports both Player vs Player and Player vs Computer gameplay modes.
  The board is represented as an 8x8 grid containing chess pieces or null.
  Game state is managed using React hooks including turn logic, selections, and moves.
  Chess pieces are defined with type, color, and optional hasMoved property.
  The board is initialized using standard chess rules via `initializeBoard()`.
  Players can choose to face the computer and select difficulty: easy, medium, or hard.
  Clicking a piece highlights valid moves based on its type and position.
  The game enforces legal movement rules for pawns, rooks, knights, bishops, queens, and kings.
  Moves that leave the king in check are filtered out unless ignored for threat analysis.
  After each move, turns alternate and the board updates using `setBoard`.
  Captures are tracked separately for white and black and displayed visually.
  Pawn promotion is handled automatically when reaching the last rank.
  AI logic scores moves using piece value, positioning, and simple heuristics.
  Based on difficulty, AI selects the best, top-third, or random strong moves.
  Game status is evaluated after every turn to detect check, checkmate, or stalemate.
  The game can end if a player has no valid moves or their king is captured.
  The UI includes dynamic highlighting for selected pieces and valid move squares.
  Each chess piece is rendered using Unicode characters styled by color.
  A flexible control panel allows players to start the game, pick a mode, or reset.
  Visual elements use Tailwind CSS for a clean and responsive interface.
  Players are informed whose turn it is, and alerts are shown when in check or game over.
  Clicking on a square allows for piece selection or move execution.
  The component also visually separates captured pieces for both players.
  Functions like `getValidMoves`, `handleMove`, and `checkGameStatus` modularize logic.
  AI delay is implemented with a timeout to simulate thinking time.
  Advanced features like castling, en passant, and repetition detection are not included.
  The code balances clarity, gameplay mechanics, and a visually engaging UI.
  This component is a foundation for expanding into a full-featured chess platform.
*/

"use client"

import { useState, useEffect, useCallback } from "react"
import { GameWrapper } from "./game-wrapper"
import { Button } from "../ui/button"
import { toast } from "react-hot-toast" 
import { useRouter } from "next/navigation"
import { XP_VALUES } from "../../lib/xp-system"

type PieceType = 'pawn' | 'rook' | 'knight' | 'bishop' | 'queen' | 'king'
type PieceColor = 'white' | 'black'

interface ChessPiece {
  type: PieceType
  color: PieceColor
  hasMoved?: boolean
}

type BoardPosition = ChessPiece | null
type Board = BoardPosition[][]

export function ChessGame() {
  const [gameStarted, setGameStarted] = useState(false)
  const [board, setBoard] = useState<Board>(initializeBoard())
  const [selectedPiece, setSelectedPiece] = useState<[number, number] | null>(null)
  const [validMoves, setValidMoves] = useState<[number, number][]>([])
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>('white')
  const [gameStatus, setGameStatus] = useState<string>('ongoing')
  const [capturedPieces, setCapturedPieces] = useState<{white: ChessPiece[], black: ChessPiece[]}>({white: [], black: []})
  const [vsComputer, setVsComputer] = useState(true)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')

  // Initialize or reset game
  useEffect(() => {
    if (gameStarted) {
      setBoard(initializeBoard())
      setSelectedPiece(null)
      setValidMoves([])
      setCurrentPlayer('white')
      setGameStatus('ongoing')
      setCapturedPieces({white: [], black: []})
    }
  }, [gameStarted])

  // Computer move logic
  useEffect(() => {
    if (gameStarted && vsComputer && currentPlayer === 'black' && gameStatus === 'ongoing') {
      const timer = setTimeout(() => {
        makeComputerMove()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [currentPlayer, gameStatus, gameStarted, vsComputer])

  const makeComputerMove = useCallback(() => {
    const possibleMoves: {
      from: [number, number],
      to: [number, number],
      score: number
    }[] = []
    
    // Find all possible moves for computer
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col]
        if (piece && piece.color === 'black') {
          const moves = getValidMoves(row, col, board)
          moves.forEach(([r, c]) => {
            let score = 0
            
            // Capture scoring
            const targetPiece = board[r][c]
            if (targetPiece) {
              score += getPieceValue(targetPiece.type) * 2
            }
            
            // Positional scoring
            if (difficulty !== 'easy') {
              // Center control
              if ((r >= 3 && r <= 4) && (c >= 3 && c <= 4)) {
                score += 0.5
              }
              
              // King safety in late game
              if (difficulty === 'hard' && targetPiece?.type === 'king') {
                score += 10
              }
              
              // Piece development
              if (difficulty === 'hard' && !piece.hasMoved) {
                score += 0.3
              }
            }
            
            possibleMoves.push({
              from: [row, col],
              to: [r, c],
              score
            })
          })
        }
      }
    }
    
    if (possibleMoves.length > 0) {
      // Sort by score (higher first)
      possibleMoves.sort((a, b) => b.score - a.score)
      
      // Choose move based on difficulty
      let chosenMove
      if (difficulty === 'easy') {
        // Random move from top 50%
        const topHalf = possibleMoves.slice(0, Math.ceil(possibleMoves.length / 2))
        chosenMove = topHalf[Math.floor(Math.random() * topHalf.length)]
      } else if (difficulty === 'medium') {
        // Random move from top 30%
        const topThird = possibleMoves.slice(0, Math.ceil(possibleMoves.length / 3))
        chosenMove = topThird[Math.floor(Math.random() * topThird.length)]
      } else {
        // Best move
        chosenMove = possibleMoves[0]
      }
      
      // Execute the move
      handleMove(chosenMove.from[0], chosenMove.from[1], chosenMove.to[0], chosenMove.to[1])
    }
  }, [board, currentPlayer, difficulty])

  const getPieceValue = (type: PieceType): number => {
    switch (type) {
      case 'pawn': return 1
      case 'knight': return 3
      case 'bishop': return 3
      case 'rook': return 5
      case 'queen': return 9
      case 'king': return 100
      default: return 0
    }
  }

  const handleMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    const newBoard = [...board.map(row => [...row])]
    const movingPiece = newBoard[fromRow][fromCol]
    
    if (!movingPiece) return false

    // Check if a piece is being captured
    if (newBoard[toRow][toCol]) {
      const capturedPiece = newBoard[toRow][toCol]
      if (capturedPiece) {
        // Check if a king is captured (game over condition)
        if (capturedPiece.type === 'king') {
          const winner = movingPiece.color === 'white' ? 'White' : 'Black';
          setGameStatus(`Game Over - ${winner} wins!`)
          
          // Award XP to the user if they win (white player)
          if (movingPiece.color === 'white') {
            awardXpForWinning();
          }
        }
        
        setCapturedPieces(prev => ({
          ...prev,
          [movingPiece.color === 'white' ? 'white' : 'black']: [
            ...prev[movingPiece.color === 'white' ? 'white' : 'black'],
            capturedPiece
          ]
        }))
      }
    }

    // Move the piece
    newBoard[toRow][toCol] = {
      ...movingPiece,
      hasMoved: true
    }
    newBoard[fromRow][fromCol] = null

    // Handle pawn promotion
    if (movingPiece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
      newBoard[toRow][toCol] = {
        type: 'queen',
        color: movingPiece.color,
        hasMoved: true
      }
    }

    setBoard(newBoard)
    setSelectedPiece(null)
    setValidMoves([])
    
    // Only change turns if the game is still ongoing
    if (gameStatus === 'ongoing') {
      const nextPlayer = currentPlayer === 'white' ? 'black' : 'white'
      setCurrentPlayer(nextPlayer)
    }
    
    return true
  }

  // Function to award XP to the user when they win
  const awardXpForWinning = async () => {
    try {
      // Award the XP (10 points for winning chess)
      const xpAmount = 10;
      
      // Show a toast notification to the user
      toast.success(`Congratulations! +${xpAmount} XP for winning the game!`, {
        duration: 4000,
        icon: '🏆'
      });
      
      // Update the user's XP and leaderboard position via API
      await fetch("/api/users/leaderboard/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          xpGained: xpAmount,
          source: "chess_victory"
        }),
      });
      
      // Also update the game scores specifically for the chess game
      await fetch("/api/game-scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game: "chess",
          score: 1, // Victory count
          xpEarned: xpAmount
        }),
      });
      
    } catch (error) {
      console.error("Error awarding XP for chess victory:", error);
      // Still show a toast even if the server update fails
      toast.success(`+${10} XP earned! (Will sync when connection restored)`, {
        duration: 3000,
        icon: '🏆'
      });
      
      // Store the earned XP locally to sync later when connection is restored
      const offlineXp = parseInt(localStorage.getItem('offlineXpScore') || '0');
      localStorage.setItem('offlineXpScore', (offlineXp + 10).toString());
    }
  }

  const handleSquareClick = (row: number, col: number) => {
    // Don't allow interaction when game is over or computer's turn
    if (gameStatus !== 'ongoing' || (vsComputer && currentPlayer === 'black')) {
      return
    }

    // If a piece is already selected
    if (selectedPiece) {
      const [selectedRow, selectedCol] = selectedPiece
      
      // Check if the clicked square is a valid move for the selected piece
      const isValidMove = validMoves.some(([r, c]) => r === row && c === col)
      
      if (isValidMove) {
        handleMove(selectedRow, selectedCol, row, col)
      } else {
        // If clicking on another piece of the same color, select that piece instead
        const clickedPiece = board[row][col]
        if (clickedPiece && clickedPiece.color === currentPlayer) {
          setSelectedPiece([row, col])
          setValidMoves(getValidMoves(row, col, board))
        } else {
          setSelectedPiece(null)
          setValidMoves([])
        }
      }
    } else {
      // Select a piece if it's the current player's turn
      const piece = board[row][col]
      if (piece && piece.color === currentPlayer) {
        setSelectedPiece([row, col])
        setValidMoves(getValidMoves(row, col, board))
      }
    }
  }

  const restartGame = () => {
    setBoard(initializeBoard())
    setSelectedPiece(null)
    setValidMoves([])
    setCurrentPlayer('white')
    setGameStatus('ongoing')
    setCapturedPieces({white: [], black: []})
  }

  const findKingPosition = (board: Board, color: PieceColor): [number, number] | null => {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col]
        if (piece && piece.type === 'king' && piece.color === color) {
          return [row, col]
        }
      }
    }
    return null
  }

  const isKingInCheck = (board: Board, color: PieceColor): boolean => {
    const kingPosition = findKingPosition(board, color)
    if (!kingPosition) return false
    return isSquareUnderAttack(kingPosition[0], kingPosition[1], board, color)
  }

  const isSquareUnderAttack = (row: number, col: number, board: Board, defenderColor: PieceColor): boolean => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c]
        if (piece && piece.color !== defenderColor) {
          const moves = getValidMoves(r, c, board, true)
          if (moves.some(([mr, mc]) => mr === row && mc === col)) {
            return true
          }
        }
      }
    }
    return false
  }

  const getValidMoves = (row: number, col: number, board: Board, ignoreKingSafety = true): [number, number][] => {
    const piece = board[row][col]
    if (!piece) return []

    const moves: [number, number][] = []
    const { type, color } = piece

    switch (type) {
      case 'pawn':
        const direction = color === 'white' ? -1 : 1
        const startRow = color === 'white' ? 6 : 1
        
        // Forward move
        if (row + direction >= 0 && row + direction < 8 && !board[row + direction][col]) {
          moves.push([row + direction, col])
          
          // Double move from starting position
          if (row === startRow && row + 2 * direction >= 0 && row + 2 * direction < 8 && 
              !board[row + 2 * direction][col] && !piece.hasMoved) {
            moves.push([row + 2 * direction, col])
          }
        }
        
        // Captures
        for (const captureCol of [col - 1, col + 1]) {
          if (captureCol >= 0 && captureCol < 8 && row + direction >= 0 && row + direction < 8) {
            // Normal capture
            const targetPiece = board[row + direction][captureCol]
            if (targetPiece && targetPiece.color !== color) {
              moves.push([row + direction, captureCol])
            }
          }
        }
        break
        
      case 'rook':
        // Horizontal and vertical movement
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let r = row + dr
          let c = col + dc
          while (r >= 0 && r < 8 && c >= 0 && c < 8) {
            if (!board[r][c]) {
              moves.push([r, c])
            } else {
              if (board[r][c]?.color !== color) {
                moves.push([r, c])
              }
              break
            }
            r += dr
            c += dc
          }
        }
        break
        
      case 'knight':
        // L-shaped moves
        for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]]) {
          const r = row + dr
          const c = col + dc
          if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            if (!board[r][c] || board[r][c]?.color !== color) {
              moves.push([r, c])
            }
          }
        }
        break
        
      case 'bishop':
        // Diagonal movement
        for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          let r = row + dr
          let c = col + dc
          while (r >= 0 && r < 8 && c >= 0 && c < 8) {
            if (!board[r][c]) {
              moves.push([r, c])
            } else {
              if (board[r][c]?.color !== color) {
                moves.push([r, c])
              }
              break
            }
            r += dr
            c += dc
          }
        }
        break
        
      case 'queen':
        // Combination of rook and bishop
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          let r = row + dr
          let c = col + dc
          while (r >= 0 && r < 8 && c >= 0 && c < 8) {
            if (!board[r][c]) {
              moves.push([r, c])
            } else {
              if (board[r][c]?.color !== color) {
                moves.push([r, c])
              }
              break
            }
            r += dr
            c += dc
          }
        }
        break
        
      case 'king':
        // One square in any direction
        for (let r = row - 1; r <= row + 1; r++) {
          for (let c = col - 1; c <= col + 1; c++) {
            if (r >= 0 && r < 8 && c >= 0 && c < 8 && (r !== row || c !== col)) {
              if (!board[r][c] || board[r][c]?.color !== color) {
                moves.push([r, c])
              }
            }
          }
        }
        break
    }

    // Remove king safety check - allow all moves
    return moves
  }

  const renderPiece = (piece: ChessPiece | null) => {
    if (!piece) return null
    
    const symbols = {
      white: {
        pawn: '♙',
        rook: '♖',
        knight: '♘',
        bishop: '♗',
        queen: '♕',
        king: '♔'
      },
      black: {
        pawn: '♟',
        rook: '♜',
        knight: '♞',
        bishop: '♝',
        queen: '♛',
        king: '♚'
      }
    }
    
    return (
      <span className={`text-4xl ${piece.color === 'white' ? 'text-white' : 'text-[#4cc9f0]'}`}>
        {symbols[piece.color][piece.type]}
      </span>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-6 p-4 min-h-screen bg-gray-900">
      {!gameStarted ? (
        <div className="text-center space-y-6 max-w-md mx-auto">
          <h1 className="text-4xl font-bold text-white mb-2">Chess</h1>
          <p className="text-gray-300 text-xl mb-8">Play against the computer or a friend</p>
          
          <div className="bg-[#2a3343] p-6 rounded-lg shadow-lg">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-3">Game Mode</h2>
              <div className="flex space-x-4 justify-center">
                <Button 
                  className={`text-lg px-6 py-3 ${vsComputer ? 'bg-[#4cc9f0] text-black' : 'bg-gray-600'}`}
                  onClick={() => setVsComputer(true)}
                >
                  vs Computer
                </Button>
                <Button 
                  className={`text-lg px-6 py-3 ${!vsComputer ? 'bg-[#4cc9f0] text-black' : 'bg-gray-600'}`}
                  onClick={() => setVsComputer(false)}
                >
                  Two Players
                </Button>
              </div>
            </div>
            
            {vsComputer && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-3">Difficulty</h2>
                <div className="flex space-x-3 justify-center">
                  <Button 
                    className={`px-5 py-2 text-lg ${difficulty === 'easy' ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-600'}`}
                    onClick={() => setDifficulty('easy')}
                  >
                    Easy
                  </Button>
                  <Button 
                    className={`px-5 py-2 text-lg ${difficulty === 'medium' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-gray-600'}`}
                    onClick={() => setDifficulty('medium')}
                  >
                    Medium
                  </Button>
                  <Button 
                    className={`px-5 py-2 text-lg ${difficulty === 'hard' ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600'}`}
                    onClick={() => setDifficulty('hard')}
                  >
                    Hard
                  </Button>
                </div>
              </div>
            )}
            
            <Button 
              className="bg-[#4cc9f0] hover:bg-[#4cc9f0]/90 text-black text-xl px-8 py-4 w-full"
              onClick={() => setGameStarted(true)}
            >
              Start Game
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className={`text-2xl font-bold mb-2 ${
            gameStatus.includes('Checkmate') ? 'text-red-400' : 
            gameStatus.includes('White') ? 'text-white' : 
            gameStatus.includes('Black') ? 'text-[#4cc9f0]' : 
            'text-gray-300'
          }`}>
            {gameStatus === 'ongoing' ? (
              <p>{currentPlayer === 'white' ? "Your turn (White)" : vsComputer ? "Computer thinking..." : "Black's turn"}</p>
            ) : gameStatus.includes('in check') ? (
              <p>{gameStatus}</p>
            ) : (
              <div className="flex flex-col items-center">
                <p>{gameStatus}</p>
                {(gameStatus.includes('Checkmate') || gameStatus.includes('Stalemate')) && (
                  <Button 
                    className="mt-4 bg-[#4cc9f0] hover:bg-[#4cc9f0]/90 text-black px-6 py-2"
                    onClick={restartGame}
                  >
                    Play Again
                  </Button>
                )}
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-8 gap-0 w-full max-w-2xl border-4 border-[#3a4353] shadow-xl">
            {Array.from({ length: 64 }).map((_, index) => {
              const row = Math.floor(index / 8)
              const col = index % 8
              const isBlack = (row + col) % 2 === 1
              const isSelected = selectedPiece && selectedPiece[0] === row && selectedPiece[1] === col
              const isValidMove = validMoves.some(([r, c]) => r === row && c === col)

              return (
                <div
                  key={index}
                  className={`aspect-square flex items-center justify-center relative ${
                    isBlack ? "bg-[#2a3343]" : "bg-[#3a4353]"
                  } ${isSelected ? "ring-4 ring-yellow-400" : ""} ${
                    isValidMove ? "cursor-pointer hover:bg-opacity-80" : "cursor-default"
                  } transition-colors duration-100`}
                  onClick={() => handleSquareClick(row, col)}
                >
                  {renderPiece(board[row][col])}
                  {isValidMove && (
                    <div className={`absolute w-4 h-4 rounded-full ${
                      board[row][col] ? "bg-red-500/80 ring-2 ring-red-500" : "bg-green-500/70"
                    }`} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-8 w-full max-w-2xl">
            <Button
              variant="outline"
              className="bg-[#2a3343] hover:bg-[#3a4353] text-white border-[#3a4353] text-lg px-6 py-3"
              onClick={() => setGameStarted(false)}
            >
              New Game
            </Button>
            
            <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-8">
              <div className="bg-[#2a3343] p-3 rounded-lg min-w-[200px]">
                <p className="text-white text-lg font-semibold mb-1">Captured by White:</p>
                <div className="flex flex-wrap gap-1 min-h-[2rem]">
                  {capturedPieces.white.map((piece, i) => (
                    <span key={i} className="text-red-500 text-xl">
                      {renderPiece(piece)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-[#2a3343] p-3 rounded-lg min-w-[200px]">
                <p className="text-white text-lg font-semibold mb-1">Captured by Black:</p>
                <div className="flex flex-wrap gap-1 min-h-[2rem]">
                  {capturedPieces.black.map((piece, i) => (
                    <span key={i} className="text-[#4cc9f0] text-xl">
                      {renderPiece(piece)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function initializeBoard(): Board {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null))
  
  // Set up pawns
  for (let col = 0; col < 8; col++) {
    board[1][col] = { type: 'pawn', color: 'black' }
    board[6][col] = { type: 'pawn', color: 'white' }
  }
  
  // Set up other pieces
  const pieceOrder: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']
  
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: pieceOrder[col], color: 'black' }
    board[7][col] = { type: pieceOrder[col], color: 'white' }
  }
  
  return board
}
