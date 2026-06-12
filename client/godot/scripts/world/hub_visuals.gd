class_name HubVisuals
extends RefCounted

## Builds simple 3D props without external art files.


static func setup_world_environment(parent: Node3D) -> void:
	if parent.get_node_or_null("WorldEnvironment"):
		return

	var environment := Environment.new()
	environment.background_mode = Environment.BG_SKY
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	environment.ambient_light_energy = 0.35
	environment.tonemap_mode = Environment.TONEMAP_MODE_FILMIC

	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("#4f8fd4")
	sky_material.sky_horizon_color = Color("#c5dff0")
	sky_material.ground_horizon_color = Color("#5f7f52")
	sky_material.ground_bottom_color = Color("#2f3d2a")
	sky_material.sun_angle_max = 35.0
	sky.sky_material = sky_material
	environment.sky = sky

	var world_environment := WorldEnvironment.new()
	world_environment.name = "WorldEnvironment"
	world_environment.environment = environment
	parent.add_child(world_environment)


static func create_ground_material() -> StandardMaterial3D:
	var image := Image.create(128, 128, false, Image.FORMAT_RGB8)
	for y in range(128):
		for x in range(128):
			var checker := ((x / 12) + (y / 12)) % 2 == 0
			var color := Color("#5f9f6a") if checker else Color("#4a7d54")
			image.set_pixel(x, y, color)

	var texture := ImageTexture.create_from_image(image)
	var material := StandardMaterial3D.new()
	material.albedo_texture = texture
	material.uv1_scale = Vector3(8, 8, 8)
	material.roughness = 0.95
	return material


static func create_path_material() -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#b9a284")
	material.roughness = 1.0
	return material


static func populate_decorations(parent: Node3D) -> void:
	if parent.get_node_or_null("Decorations"):
		return

	var root := Node3D.new()
	root.name = "Decorations"
	parent.add_child(root)

	_add_plaza(root)
	_add_path(root)
	_add_trees(root)
	_add_rocks(root)
	_add_fences(root)
	_add_hunt_board(root)
	_add_lanterns(root)


static func _add_plaza(root: Node3D) -> void:
	var plaza := MeshInstance3D.new()
	var mesh := CylinderMesh.new()
	mesh.top_radius = 7.0
	mesh.bottom_radius = 7.0
	mesh.height = 0.15
	plaza.mesh = mesh
	plaza.position = Vector3(0, 0.08, 0)
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#c8b090")
	material.roughness = 0.85
	plaza.material_override = material
	root.add_child(plaza)


static func _add_path(root: Node3D) -> void:
	var path := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = Vector3(3.0, 0.08, 10.0)
	path.mesh = mesh
	path.position = Vector3(0, 0.05, -5.0)
	path.material_override = create_path_material()
	root.add_child(path)


static func _add_trees(root: Node3D) -> void:
	var positions := [
		Vector3(14, 0, 10), Vector3(-14, 0, 10), Vector3(14, 0, -10), Vector3(-14, 0, -10),
		Vector3(10, 0, 15), Vector3(-10, 0, 15), Vector3(10, 0, -15), Vector3(-10, 0, -15),
		Vector3(18, 0, 0), Vector3(-18, 0, 0),
	]
	for pos in positions:
		root.add_child(_create_tree(pos))


static func _create_tree(position: Vector3) -> Node3D:
	var tree := Node3D.new()
	tree.position = position
	tree.rotate_y(randf() * TAU)

	var trunk := MeshInstance3D.new()
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.25
	trunk_mesh.bottom_radius = 0.35
	trunk_mesh.height = 1.6
	trunk.mesh = trunk_mesh
	trunk.position = Vector3(0, 0.8, 0)
	var trunk_mat := StandardMaterial3D.new()
	trunk_mat.albedo_color = Color("#6d4c2f")
	trunk.material_override = trunk_mat
	tree.add_child(trunk)

	var leaves := MeshInstance3D.new()
	var leaves_mesh := SphereMesh.new()
	leaves_mesh.radius = 1.2
	leaves_mesh.height = 2.0
	leaves.mesh = leaves_mesh
	leaves.position = Vector3(0, 2.1, 0)
	var leaves_mat := StandardMaterial3D.new()
	leaves_mat.albedo_color = Color("#3f8f4a")
	leaves.material_override = leaves_mat
	tree.add_child(leaves)

	return tree


static func _add_rocks(root: Node3D) -> void:
	var positions := [
		Vector3(8, 0, 4), Vector3(-7, 0, 5), Vector3(6, 0, -8), Vector3(-8, 0, -6),
		Vector3(12, 0, -2), Vector3(-11, 0, 2),
	]
	for pos in positions:
		root.add_child(_create_rock(pos))


static func _create_rock(position: Vector3) -> MeshInstance3D:
	var rock := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = randf_range(0.35, 0.7)
	mesh.height = mesh.radius * 1.4
	rock.mesh = mesh
	rock.position = position + Vector3(0, mesh.radius * 0.5, 0)
	rock.scale = Vector3(randf_range(0.9, 1.3), randf_range(0.6, 1.0), randf_range(0.9, 1.3))
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("#7a7f84")
	material.roughness = 1.0
	rock.material_override = material
	return rock


static func _add_fences(root: Node3D) -> void:
	var offsets := [
		Vector3(0, 0, 18), Vector3(0, 0, -18), Vector3(18, 0, 0), Vector3(-18, 0, 0),
	]
	var rotations := [0.0, 0.0, PI * 0.5, PI * 0.5]
	for i in offsets.size():
		var fence := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(16, 0.8, 0.2)
		fence.mesh = mesh
		fence.position = offsets[i] + Vector3(0, 0.4, 0)
		fence.rotation.y = rotations[i]
		var material := StandardMaterial3D.new()
		material.albedo_color = Color("#8b6a43")
		fence.material_override = material
		root.add_child(fence)


static func _add_hunt_board(root: Node3D) -> void:
	var board_root := Node3D.new()
	board_root.position = Vector3(0, 0, -9.0)

	var post := MeshInstance3D.new()
	var post_mesh := BoxMesh.new()
	post_mesh.size = Vector3(0.3, 2.2, 0.3)
	post.mesh = post_mesh
	post.position = Vector3(0, 1.1, 0)
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color("#7a5535")
	post.material_override = wood
	board_root.add_child(post)

	var sign := MeshInstance3D.new()
	var sign_mesh := BoxMesh.new()
	sign_mesh.size = Vector3(2.8, 1.4, 0.15)
	sign.mesh = sign_mesh
	sign.position = Vector3(0, 2.0, 0)
	var sign_mat := StandardMaterial3D.new()
	sign_mat.albedo_color = Color("#5c3d22")
	sign.material_override = sign_mat
	board_root.add_child(sign)

	var label := Label3D.new()
	label.text = "HUNT BOARD"
	label.font_size = 42
	label.position = Vector3(0, 2.0, 0.12)
	label.modulate = Color("#f2e3c6")
	board_root.add_child(label)

	root.add_child(board_root)


static func _add_lanterns(root: Node3D) -> void:
	var positions := [
		Vector3(5, 0, 5), Vector3(-5, 0, 5), Vector3(5, 0, -5), Vector3(-5, 0, -5),
	]
	for pos in positions:
		var lantern_root := Node3D.new()
		lantern_root.position = pos

		var pole := MeshInstance3D.new()
		var pole_mesh := CylinderMesh.new()
		pole_mesh.top_radius = 0.08
		pole_mesh.bottom_radius = 0.1
		pole_mesh.height = 2.5
		pole.mesh = pole_mesh
		pole.position = Vector3(0, 1.25, 0)
		var pole_mat := StandardMaterial3D.new()
		pole_mat.albedo_color = Color("#4a4a4a")
		pole.material_override = pole_mat
		lantern_root.add_child(pole)

		var lamp := MeshInstance3D.new()
		var lamp_mesh := BoxMesh.new()
		lamp_mesh.size = Vector3(0.35, 0.45, 0.35)
		lamp.mesh = lamp_mesh
		lamp.position = Vector3(0, 2.55, 0)
		var lamp_mat := StandardMaterial3D.new()
		lamp_mat.albedo_color = Color("#ffe8a3")
		lamp_mat.emission_enabled = true
		lamp_mat.emission = Color("#ffcc66")
		lamp_mat.emission_energy_multiplier = 0.6
		lamp.material_override = lamp_mat
		lantern_root.add_child(lamp)

		var light := OmniLight3D.new()
		light.position = Vector3(0, 2.55, 0)
		light.light_color = Color("#ffd699")
		light.light_energy = 0.5
		light.omni_range = 5.0
		lantern_root.add_child(light)

		root.add_child(lantern_root)
