extends CharacterBody3D

@export var player_name := "Hunter"
@export var skin_color := Color.from_string("#6EC6FF", Color.CYAN)

const MOVE_SPEED := 6.0

@onready var mesh: MeshInstance3D = $MeshInstance3D
@onready var name_label: Label3D = $NameLabel


func _ready() -> void:
	_apply_visuals()

	if is_multiplayer_authority():
		_setup_local_camera()
	else:
		set_process_input(false)


func configure(profile: Dictionary) -> void:
	player_name = str(profile.get("displayName", profile.get("display_name", "Hunter")))
	skin_color = Color.from_string(str(profile.get("skinColor", profile.get("skin_color", "#6EC6FF"))), Color.CYAN)
	_apply_visuals()


func _apply_visuals() -> void:
	if name_label:
		name_label.text = player_name
	if mesh:
		var material := StandardMaterial3D.new()
		material.albedo_color = skin_color
		mesh.material_override = material


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
