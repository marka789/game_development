extends PanelContainer

signal party_updated(party: Dictionary)

const REFRESH_SECONDS := 3.0

@onready var friends_list: ItemList = %FriendsList
@onready var party_list: ItemList = %PartyList
@onready var add_friend_field: LineEdit = %AddFriendField
@onready var social_status: Label = %SocialStatus
@onready var ready_button: Button = %ReadyButton
@onready var invite_button: Button = %InviteButton
@onready var create_party_button: Button = %CreatePartyButton
@onready var leave_party_button: Button = %LeavePartyButton
@onready var start_hunt_button: Button = %StartHuntButton

var _friends: Array = []
var _party: Dictionary = {}
var _is_ready := true
var _am_party_leader := false


func _ready() -> void:
	visible = false
	friends_list.item_selected.connect(func(_idx: int) -> void: _update_buttons())
	%AddFriendButton.pressed.connect(_on_add_friend_pressed)
	%AcceptFriendButton.pressed.connect(_on_accept_friend_pressed)
	%RefreshButton.pressed.connect(refresh_all)
	create_party_button.pressed.connect(_on_create_party_pressed)
	invite_button.pressed.connect(_on_invite_pressed)
	leave_party_button.pressed.connect(_on_leave_party_pressed)
	ready_button.toggled.connect(_on_ready_toggled)
	start_hunt_button.pressed.connect(_on_start_hunt_pressed)

	refresh_all()
	var timer := Timer.new()
	timer.wait_time = REFRESH_SECONDS
	timer.autostart = true
	timer.timeout.connect(refresh_all)
	add_child(timer)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("toggle_social"):
		visible = not visible
		if visible:
			refresh_all()


func refresh_all() -> void:
	await _refresh_friends()
	await _refresh_party()


func _refresh_friends() -> void:
	var result := await ApiClient.fetch_friends()
	if not result.ok:
		social_status.text = result.error
		return

	_friends = result.data.get("friends", [])
	friends_list.clear()
	for friend in _friends:
		var username := str(friend.get("username", "?"))
		var display := str(friend.get("display_name", username))
		var status := str(friend.get("status", ""))
		var direction := str(friend.get("direction", ""))
		var online := "online" if friend.get("online", false) else "offline"
		var marker := "●" if friend.get("online", false) else "○"

		var line := "%s %s (%s)" % [marker, display, online]
		if status == "pending":
			if direction == "incoming":
				line = "%s [accept?] %s" % [marker, display]
			else:
				line = "%s %s (pending)" % [marker, display]

		friends_list.add_item(line)

	_update_buttons()


func _refresh_party() -> void:
	var result := await ApiClient.fetch_party()
	if not result.ok:
		social_status.text = result.error
		return

	var party = result.data.get("party")
	_party = party if typeof(party) == TYPE_DICTIONARY else {}
	party_list.clear()

	if _party.is_empty():
		social_status.text = "No party — create one to group up."
		_am_party_leader = false
		invite_button.disabled = true
		leave_party_button.disabled = true
		ready_button.disabled = true
		start_hunt_button.disabled = true
		party_updated.emit({})
		_update_buttons()
		return

	var my_username := str(GameState.profile.get("username", ""))
	var members: Array = _party.get("members", [])
	_am_party_leader = false
	for member in members:
		var username := str(member.get("username", "?"))
		var display := str(member.get("display_name", username))
		var leader_mark := " ★" if member.get("is_leader", false) else ""
		var ready_mark := " [ready]" if member.get("is_ready", false) else ""
		party_list.add_item("%s%s%s" % [display, leader_mark, ready_mark])
		if username == my_username and member.get("is_leader", false):
			_am_party_leader = true
		if username == my_username:
			_is_ready = member.get("is_ready", false)
			ready_button.set_pressed_no_signal(_is_ready)

	start_hunt_button.disabled = not _am_party_leader
	leave_party_button.disabled = false
	ready_button.disabled = false
	social_status.text = "Party ready. Invite friends, then toggle Ready."
	party_updated.emit(_party)
	_update_buttons()


func _selected_friend() -> Dictionary:
	var idx := friends_list.get_selected_items()
	if idx.is_empty():
		return {}
	var index: int = idx[0]
	if index < 0 or index >= _friends.size():
		return {}
	return _friends[index]


func _update_buttons() -> void:
	var friend := _selected_friend()
	var has_friend := not friend.is_empty()
	var is_pending_incoming := (
		has_friend
		and str(friend.get("status", "")) == "pending"
		and str(friend.get("direction", "")) == "incoming"
	)
	%AcceptFriendButton.disabled = not is_pending_incoming
	var can_invite := (
		_am_party_leader
		and has_friend
		and str(friend.get("status", "")) == "accepted"
	)
	invite_button.disabled = not can_invite


func _on_add_friend_pressed() -> void:
	var username := add_friend_field.text.strip_edges()
	if username.is_empty():
		return
	social_status.text = "Sending friend request..."
	var result := await ApiClient.request_friend(username)
	social_status.text = "Friend request sent." if result.ok else result.error
	add_friend_field.text = ""
	await refresh_all()


func _on_accept_friend_pressed() -> void:
	var friend := _selected_friend()
	if friend.is_empty():
		return
	var result := await ApiClient.accept_friend(str(friend.get("username", "")))
	social_status.text = "Friend accepted." if result.ok else result.error
	await refresh_all()


func _on_create_party_pressed() -> void:
	social_status.text = "Creating party..."
	var result := await ApiClient.create_party()
	social_status.text = "Party created." if result.ok else result.error
	await refresh_all()


func _on_invite_pressed() -> void:
	var friend := _selected_friend()
	if friend.is_empty():
		return
	var username := str(friend.get("username", ""))
	social_status.text = "Inviting %s..." % username
	var result := await ApiClient.invite_to_party(username)
	social_status.text = "Invited %s." % username if result.ok else result.error
	await refresh_all()


func _on_leave_party_pressed() -> void:
	var result := await ApiClient.leave_party()
	social_status.text = "Left party." if result.ok else result.error
	await refresh_all()


func _on_ready_toggled(pressed: bool) -> void:
	var result := await ApiClient.set_party_ready(pressed)
	if not result.ok:
		social_status.text = result.error
		ready_button.set_pressed_no_signal(_is_ready)
		return
	_is_ready = pressed
	await refresh_all()


func _on_start_hunt_pressed() -> void:
	social_status.text = "Starting hunt..."
	var result := await ApiClient.start_hunt()
	if not result.ok:
		social_status.text = result.error
		return
	social_status.text = "Hunt session created (scene coming Week 7)."
