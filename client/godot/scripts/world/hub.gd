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
@onready var fallback_camera: Camera3D = %FallbackCamera
@onready var social_panel: PanelContainer = %SocialPanel

var _spawn_index := 0
var _players_by_peer: Dictionary = {}
var _party_usernames: Array[String] = []


func _ready() -> void:
	_setup_visuals()

	HubNetwork.peer_authenticated.connect(_on_peer_authenticated)
	HubNetwork.peer_disconnected.connect(_on_peer_disconnected)
	HubNetwork.authentication_failed.connect(_on_authentication_failed)
	if social_panel:
		social_panel.party_updated.connect(_on_party_updated)

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

	if fallback_camera:
		fallback_camera.current = true

	var display_name := str(GameState.profile.get("display_name", "Hunter"))
	_set_status("Welcome, %s — spawning avatar..." % display_name)
	_update_net_info()

	await get_tree().process_frame
	await get_tree().process_frame
	HubNetwork.register_with_server()
	_wait_for_local_player(display_name)


func _on_peer_authenticated(peer_id: int, profile: Dictionary) -> void:
	if not multiplayer.is_server():
		return

	var spawn_pos := _next_spawn_point()
	spawn_player_rpc.rpc(profile, peer_id, spawn_pos)


@rpc("authority", "call_local", "reliable")
func spawn_player_rpc(profile: Dictionary, peer_id: int, spawn_pos: Vector3) -> void:
	if _players_by_peer.has(peer_id):
		return

	var player: CharacterBody3D = PLAYER_SCENE.instantiate()
	player.configure(profile)
	player.name = str(peer_id)
	player.set_multiplayer_authority(peer_id)
	player.global_position = spawn_pos
	players_root.add_child(player, true)
	_players_by_peer[peer_id] = player
	if player.has_method("set_party_highlight"):
		player.set_party_highlight(player.username in _party_usernames)
	_update_net_info()

	if player.is_multiplayer_authority():
		_disable_fallback_camera()
		_set_status("Welcome, %s" % profile.get("displayName", "Hunter"))


func _on_peer_disconnected(peer_id: int) -> void:
	if _players_by_peer.has(peer_id):
		var player: Node = _players_by_peer[peer_id]
		if is_instance_valid(player):
			player.queue_free()
		_players_by_peer.erase(peer_id)
	_update_net_info()


func _on_authentication_failed(reason: String) -> void:
	_set_status("Hub auth failed: %s" % reason)


func _wait_for_local_player(display_name: String) -> void:
	for _attempt in range(50):
		for child in players_root.get_children():
			var player := child as CharacterBody3D
			if player and player.is_multiplayer_authority():
				_disable_fallback_camera()
				_set_status("Welcome, %s" % display_name)
				return
		await get_tree().create_timer(0.1).timeout

	_set_status("Avatar did not spawn. Check Terminal 3 (hub server) and Terminal 2 (API).")


func _disable_fallback_camera() -> void:
	if fallback_camera:
		fallback_camera.current = false


func _next_spawn_point() -> Vector3:
	var point: Vector3 = SPAWN_POINTS[_spawn_index % SPAWN_POINTS.size()]
	_spawn_index += 1
	return point


func _setup_visuals() -> void:
	var is_headless_server := OS.get_cmdline_user_args().has("--hub-server")
	if not is_headless_server:
		HubVisuals.setup_world_environment(self)
		HubVisuals.populate_decorations(self)
	_ensure_ground()


func _ensure_ground() -> void:
	var mesh_instance := get_node_or_null("Ground/MeshInstance3D") as MeshInstance3D
	if mesh_instance and mesh_instance.mesh == null:
		var plane := PlaneMesh.new()
		plane.size = Vector2(40, 40)
		mesh_instance.mesh = plane
		mesh_instance.material_override = HubVisuals.create_ground_material()


func _set_status(text: String) -> void:
	status_label.text = text


func _on_party_updated(party: Dictionary) -> void:
	_party_usernames.clear()
	if party.is_empty():
		_apply_party_highlights()
		return
	for member in party.get("members", []):
		_party_usernames.append(str(member.get("username", "")))
	_apply_party_highlights()


func _apply_party_highlights() -> void:
	for child in players_root.get_children():
		var player := child as CharacterBody3D
		if player and player.has_method("set_party_highlight"):
			var in_party := player.username in _party_usernames
			player.set_party_highlight(in_party)


func _update_net_info() -> void:
	var player_count := players_root.get_child_count()
	if HubNetwork.is_hub_server:
		net_label.text = "Server | players: %s | WASD to move | Tab = social" % player_count
	else:
		var my_id := multiplayer.get_unique_id()
		net_label.text = "Client #%s | players: %s | WASD | Tab = social" % [my_id, player_count]
