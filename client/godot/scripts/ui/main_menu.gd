extends Control

@onready var username_field: LineEdit = %UsernameField
@onready var password_field: LineEdit = %PasswordField
@onready var status_label: Label = %StatusLabel
@onready var login_button: Button = %LoginButton
@onready var register_button: Button = %RegisterButton


func _ready() -> void:
	login_button.pressed.connect(_on_login_pressed)
	register_button.pressed.connect(_on_register_pressed)


func _set_status(text: String) -> void:
	status_label.text = text


func _on_login_pressed() -> void:
	_set_status("Logging in...")
	var result := await ApiClient.login(
		username_field.text.strip_edges(),
		password_field.text
	)
	if not result.ok:
		_set_status(result.error)
		return

	_set_status("Loading profile...")
	var profile_result := await GameState.load_profile()
	if not profile_result.ok:
		_set_status(profile_result.error)
		return

	get_tree().change_scene_to_file("res://scenes/hub.tscn")


func _on_register_pressed() -> void:
	_set_status("Creating account...")
	var username := username_field.text.strip_edges()
	var result := await ApiClient.register(username, password_field.text, username)
	if not result.ok:
		_set_status(result.error)
		return

	_set_status("Account created. Loading hub...")
	await GameState.load_profile()
	get_tree().change_scene_to_file("res://scenes/hub.tscn")
