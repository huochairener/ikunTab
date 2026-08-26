from __future__ import annotations
"""业务异常。"""
class BizException(Exception):
    def __init__(self, msg: str, code: int = 400):
        super().__init__(msg)
        self.code = code
        self.msg = msg
