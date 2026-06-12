extends Node3D

@onready var status_label: Label = %StatusLabel
@onready var player: CharacterBody3D = %Player

const MOVE_SPEED := 6.0


func _ready() -> void:
	status_label.text = "Welcome, %s! Hub multiplayer lands in Week 5-6." % GameState.profile.get("display_name", "Hunter")
	_ensure_ground()


func _physics_process(delta: float) -> void:
	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := (transform.basis * Vector3(input_dir.x, 0, input_dir.y)).normalized()
	if direction != Vector3.ZERO:
		player.velocity.x = direction.x * MOVE_SPEED
		player.velocity.z = direction.z * MOVE_SPEED
	else:
		player.velocity.x = move_toward(player.velocity.x, 0, MOVE_SPEED)
		player.velocity.z = move_toward(player.velocity.z, 0, MOVE_SPEED)
	player.move_and_slide()


func _ensure_ground() -> void:
	var mesh_instance := get_node_or_null("Ground/MeshInstance3D") as MeshInstance3D
	if mesh_instance and mesh_instance.mesh == null:
		var plane := PlaneMesh.new()
		plane.size = Vector2(40, 40)
		mesh_instance.mesh = plane
