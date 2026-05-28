"""Compatibility shim for loading pickled scikit-learn models relying on the private `_loss` module.

Some training environments serialize references to the legacy `_loss` module path. We delegate those
lookups to scikit-learn's current private modules so the pickle can be restored without modification.
"""

from sklearn._loss.loss import *  # noqa: F401,F403
from sklearn._loss._loss import *  # noqa: F401,F403
