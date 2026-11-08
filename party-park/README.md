# Party Park

A separate co-op puzzle from the 3D game in `client/godot`. Two to four people play in the browser. Nothing here is installed on your computer except this folder if you are running it yourself.

## What the server is

The room server is one program that keeps the shared puzzle. Your browser only draws the picture and sends left, right, and jump. Everyone in a room sees the same door, crate, and pit because the server is the one moving them.

```bash
cd party-park
npm install
npm run dev
```

Open http://localhost:5173 in two browser windows. Create a room in the first, copy the link, and join in the second. The host presses Start.

Friends on the same Wi-Fi can use the Network URL Vite prints. Friends on the internet need this same program running on a computer that stays on and has a public address. A normal website host that shuts down after a few minutes cannot keep the room alive.

## Levels

1. **Both Pads.** Stand on both pads at the same time, then everyone goes through the door.
2. **Too High.** The ledge is too high for one jump. Boost a friend up. Their pad opens the door underneath. The gap on the left is a pit: fall in and you come back to the start.
3. **Crate.** One player stands on the left pad. The other pushes the crate onto the switch. Then everyone goes to the exit.

Arrows or WASD move. Space, W, or Up jumps.
