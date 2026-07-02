"""Domain exceptions for command validation."""


class CommandRejected(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
