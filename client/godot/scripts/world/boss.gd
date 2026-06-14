extends Node3D

signal defeated()
signal hp_changed(current_hp: int, max_hp: int)

const MAX_HP := 500

@onready var mesh: MeshInstance3D = $MeshInstance3D
@onready var hp_label: Label3D = $HPLabel

var max_hp: int = MAX_HP
var hp: int = MAX_HP


func _ready() -> void:
	_update_hp_label()
	if mesh:
		var material := StandardMaterial3D.new()
		material.albedo_color = Color("#8b2e2e")
		material.emission_enabled = true
		material.emission = Color("#4a0000")
		material.emission_energy_multiplier = 0.2
		mesh.material_override = material


func reset_boss() -> void:
	hp = max_hp
	if mesh:
		mesh.scale = Vector3.ONE
	_update_hp_label()


func apply_damage(amount: int) -> void:
	if not multiplayer.is_server():
		return
	if hp <= 0:
		return

	hp = maxi(0, hp - amount)
	sync_hp.rpc(hp)
	if hp <= 0:
		defeated.emit()
		boss_defeated.rpc()


@rpc("authority", "call_local", "reliable")
func sync_hp(new_hp: int) -> void:
	hp = new_hp
	_update_hp_label()
	hp_changed.emit(hp, max_hp)


@rpc("authority", "call_local", "reliable")
func boss_defeated() -> void:
	if mesh:
		mesh.scale = Vector3(0.2, 0.2, 0.2)


func _update_hp_label() -> void:
	if hp_label:
		hp_label.text = "Boss %d / %d" % [hp, max_hp]
