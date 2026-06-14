extends Node3D

const PLAYER_SCENE := preload("res://scenes/player/player.tscn")
const SPAWN_POINTS := [
	Vector3(-3, 1, 6),
	Vector3(3, 1, 6),
	Vector3(-3, 1, 3),
	Vector3(3, 1, 3),
]

@onready var status_label: Label = %StatusLabel
@onready var hint_label: Label = %HintLabel
@onready var players_root: Node3D = %Players
@onready var boss: Node3D = %Boss
@onready var results_panel: PanelContainer = %ResultsPanel
@onready var results_label: Label = %ResultsLabel
@onready var fallback_camera: Camera3D = %FallbackCamera

var _spawn_index := 0
var _players_by_peer: Dictionary = {}
var _attack_cooldowns: Dictionary = {}
var _hunt_finished := false
var _active_hunt_session_id := ""


func _ready() -> void:
	_setup_arena()

	HuntNetwork.peer_authenticated.connect(_on_peer_authenticated)
	HuntNetwork.peer_disconnected.connect(_on_peer_disconnected)
	HuntNetwork.authentication_failed.connect(_on_authentication_failed)
	if boss.has_signal("defeated"):
		boss.defeated.connect(_on_boss_defeated)

	var args := OS.get_cmdline_user_args()
	if args.has("--hunt-server"):
		var err := HuntNetwork.start_server(7800)
		status_label.text = "Hunt server running on :7800" if err == OK else "Failed to start hunt server"
		if boss.has_method("reset_boss"):
			boss.reset_boss()
		return

	if not HuntNetwork.is_connected_to_hunt():
		status_label.text = "Not connected to hunt server"
		return

	if fallback_camera:
		fallback_camera.current = true

	status_label.text = "Hunt started — defeat the boss!"
	hint_label.text = "WASD move | Space attack | Party co-op"
	await get_tree().process_frame
	await get_tree().process_frame
	HuntNetwork.register_with_server()


func _setup_arena() -> void:
	var ground := get_node_or_null("Ground") as StaticBody3D
	if ground:
		var mesh_instance := ground.get_node_or_null("MeshInstance3D") as MeshInstance3D
		if mesh_instance and mesh_instance.mesh == null:
			var plane := PlaneMesh.new()
			plane.size = Vector2(30, 30)
			mesh_instance.mesh = plane
			var material := StandardMaterial3D.new()
			material.albedo_color = Color("#6b5344")
			mesh_instance.material_override = material
		var collision := ground.get_node_or_null("CollisionShape3D") as CollisionShape3D
		if collision and collision.shape == null:
			var box := BoxShape3D.new()
			box.size = Vector3(30, 0.2, 30)
			collision.shape = box


func _unhandled_input(event: InputEvent) -> void:
	if _hunt_finished:
		return
	if event.is_action_pressed("attack"):
		_request_local_attack()


func _request_local_attack() -> void:
	for child in players_root.get_children():
		var player := child as CharacterBody3D
		if player and player.is_multiplayer_authority():
			player_attack.rpc_id(1, multiplayer.get_unique_id())
			return


@rpc("any_peer", "call_remote", "reliable")
func player_attack(attacker_peer_id: int) -> void:
	if not multiplayer.is_server() or _hunt_finished:
		return

	var now := Time.get_ticks_msec()
	var last_attack := int(_attack_cooldowns.get(attacker_peer_id, 0))
	if now - last_attack < 400:
		return
	_attack_cooldowns[attacker_peer_id] = now

	if boss.has_method("apply_damage"):
		boss.apply_damage(25)


func _on_peer_authenticated(peer_id: int, profile: Dictionary) -> void:
	if not multiplayer.is_server():
		return

	var session_id := str(profile.get("huntSessionId", ""))
	if session_id != _active_hunt_session_id:
		_active_hunt_session_id = session_id
		_hunt_finished = false
		_spawn_index = 0
		if boss.has_method("reset_boss"):
			boss.reset_boss()

	spawn_player_rpc.rpc(profile, peer_id, _next_spawn_point())


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

	if player.is_multiplayer_authority():
		if fallback_camera:
			fallback_camera.current = false


func _on_peer_disconnected(peer_id: int) -> void:
	if _players_by_peer.has(peer_id):
		var player: Node = _players_by_peer[peer_id]
		if is_instance_valid(player):
			player.queue_free()
		_players_by_peer.erase(peer_id)


func _on_authentication_failed(reason: String) -> void:
	status_label.text = "Hunt auth failed: %s" % reason


func _on_boss_defeated() -> void:
	if _hunt_finished:
		return
	_finish_hunt(true)


func _finish_hunt(success: bool) -> void:
	if _hunt_finished:
		return
	_hunt_finished = true
	status_label.text = "Hunt complete!"
	hint_label.text = "Returning to hub..."

	var result := await ApiClient.complete_hunt(GameState.hunt_session_id, success)
	if result.ok:
		GameState.last_hunt_rewards = result.data
		_show_results(result.data, success)
	else:
		results_label.text = result.error

	await get_tree().create_timer(3.0).timeout
	var hub_result := await GameState.return_to_hub()
	if hub_result.ok:
		get_tree().change_scene_to_file("res://scenes/hub.tscn")
	else:
		status_label.text = "Failed to return to hub: %s" % hub_result.error


func _show_results(data: Dictionary, success: bool) -> void:
	results_panel.visible = true
	if success:
		results_label.text = "Victory!\n+%s XP\nLoot: %s" % [
			str(data.get("xpGained", 0)),
			str(data.get("lootItemId", "none")),
		]
	else:
		results_label.text = "Defeated...\n+%s XP" % str(data.get("xpGained", 0))


func _next_spawn_point() -> Vector3:
	var point: Vector3 = SPAWN_POINTS[_spawn_index % SPAWN_POINTS.size()]
	_spawn_index += 1
	return point
