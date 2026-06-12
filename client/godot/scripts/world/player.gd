extends CharacterBody3D

@export var player_name := "Hunter"
@export var username := ""
@export var skin_color := Color.from_string("#6EC6FF", Color.CYAN)

const MOVE_SPEED := 6.0

@onready var body_mesh: MeshInstance3D = %Body
@onready var head_mesh: MeshInstance3D = %Head
@onready var name_label: Label3D = $NameLabel


func _ready() -> void:
	_apply_visuals()

	if is_multiplayer_authority():
		_setup_local_camera()
	else:
		set_process_input(false)


func configure(profile: Dictionary) -> void:
	player_name = str(profile.get("displayName", profile.get("display_name", "Hunter")))
	username = str(profile.get("username", ""))
	skin_color = Color.from_string(str(profile.get("skinColor", profile.get("skin_color", "#6EC6FF"))), Color.CYAN)
	_apply_visuals()


func set_party_highlight(active: bool) -> void:
	if name_label:
		name_label.modulate = Color(1.0, 0.85, 0.2) if active else Color.WHITE


func _apply_visuals() -> void:
	if name_label:
		name_label.text = player_name
	if body_mesh:
		var body_material := StandardMaterial3D.new()
		body_material.albedo_color = skin_color
		body_material.roughness = 0.7
		body_mesh.material_override = body_material
	if head_mesh:
		var head_material := StandardMaterial3D.new()
		head_material.albedo_color = skin_color.lightened(0.25)
		head_material.roughness = 0.55
		head_mesh.material_override = head_material


func _setup_local_camera() -> void:
	var camera := Camera3D.new()
	camera.name = "FollowCamera"
	camera.position = Vector3(0, 4, 6)
	camera.rotation_degrees = Vector3(-20, 180, 0)
	camera.current = true
	add_child(camera)


func _physics_process(_delta: float) -> void:
	if not is_multiplayer_authority():
		return

	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := Vector3(input_dir.x, 0, input_dir.y).normalized()

	if direction != Vector3.ZERO:
		velocity.x = direction.x * MOVE_SPEED
		velocity.z = direction.z * MOVE_SPEED
	else:
		velocity.x = move_toward(velocity.x, 0, MOVE_SPEED)
		velocity.z = move_toward(velocity.z, 0, MOVE_SPEED)

	move_and_slide()
