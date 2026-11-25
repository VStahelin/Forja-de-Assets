extends AnimatableBody3D
## Goes back and forth on a sine wave, just a dumb pillar to poke the fog with

@export var axis: Vector3 = Vector3.RIGHT
@export var distance: float = 4.0
## How many full back and forth trips it does per second
@export var speed: float = 0.15

var _origin: Vector3
var _time: float = 0.0


func _ready() -> void:
	_origin = position


func _physics_process(delta: float) -> void:
	_time += delta
	position = _origin + axis.normalized() * sin(_time * speed * TAU) * distance
