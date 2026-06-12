extends Node3D

const PLAYER_SCENE := preload("res://scenes/player/player.tscn")
const SPAWN_POINTS := [
	Vector3(0, 1, 0),
	Vector3(3, 1, 0),
	Vector3(-3, 1, 0),
	Vector3(0, 1, 3),
]

@onready var status_label: Label = %StatusLabel
@onready var net_label: Label = %NetLabel
@onready var players_root: Node3D = %Players
@onready var spawner: MultiplayerSpawner = %MultiplayerSpawner

var _spawn_index := 0
var _players_by_peer: Dictionary = {}


func _ready() -> void:
	_ensure_ground()
	spawner.spawn_function = _spawn_player

	HubNetwork.peer_authenticated.connect(_on_peer_authenticated)
	HubNetwork.peer_disconnected.connect(_on_peer_disconnected)

	players_root.child_entered_tree.connect(func(_child: Node) -> void: _update_net_info())
	players_root.child_exiting_tree.connect(func(_child: Node) -> void: _update_net_info())

	var args := OS.get_cmdline_user_args()
	if args.has("--hub-server"):
		var hub_port := int(GameState.hub_join_info.get("hubPort", 7777))
		var err := HubNetwork.start_server(hub_port)
		if err != OK:
			_set_status("Failed to start hub server")
		else:
			_set_status("Hub server running on port %s" % hub_port)
		return

	if not HubNetwork.is_connected_to_hub():
		_set_status("Not connected to hub server")
		return

	_set_status("Welcome, %s" % GameState.profile.get("display_name", "Hunter"))
	HubNetwork.register_with_server()
	_update_net_info()


func _spawn_player(profile: Dictionary) -> Node:
	var player: CharacterBody3D = PLAYER_SCENE.instantiate()
	player.configure(profile)
	return player


func _on_peer_authenticated(peer_id: int, profile: Dictionary) -> void:
	if not multiplayer.is_server():
		return

	var player: CharacterBody3D = spawner.spawn(profile)
	player.name = str(peer_id)
	player.set_multiplayer_authority(peer_id)
	player.global_position = _next_spawn_point()
	_players_by_peer[peer_id] = player
	_update_net_info()


func _on_peer_disconnected(peer_id: int) -> void:
	if _players_by_peer.has(peer_id):
		var player: Node = _players_by_peer[peer_id]
		if is_instance_valid(player):
			player.queue_free()
		_players_by_peer.erase(peer_id)
	_update_net_info()


func _next_spawn_point() -> Vector3:
	var point: Vector3 = SPAWN_POINTS[_spawn_index % SPAWN_POINTS.size()]
	_spawn_index += 1
	return point


func _ensure_ground() -> void:
	var mesh_instance := get_node_or_null("Ground/MeshInstance3D") as MeshInstance3D
	if mesh_instance and mesh_instance.mesh == null:
		var plane := PlaneMesh.new()
		plane.size = Vector2(40, 40)
		mesh_instance.mesh = plane
		var material := StandardMaterial3D.new()
		material.albedo_color = Color("#3D5A4A")
		mesh_instance.material_override = material


func _set_status(text: String) -> void:
	status_label.text = text


func _update_net_info() -> void:
	var peer_count := _players_by_peer.size()
	if HubNetwork.is_hub_server:
		net_label.text = "Server | players: %s | WASD to move" % peer_count
	else:
		var my_id := multiplayer.get_unique_id()
		net_label.text = "Client #%s | online: %s | WASD to move" % [my_id, max(peer_count, players_root.get_child_count())]
