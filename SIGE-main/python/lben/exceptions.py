"Excepciones del motor LBEn."

class DataValidationError(Exception):
    """Excepción lanzada cuando los datos de entrada no pasan la validación."""
    pass


class ModelSelectionError(Exception):
    """Excepción lanzada cuando ningún modelo cumple los criterios de calidad."""
    pass
