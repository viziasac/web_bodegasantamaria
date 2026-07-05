// src/components/Modal.tsx
import React, { ReactNode } from 'react';

interface ModalProps {
    children: ReactNode;
    title: string;
    isOpen: boolean;
    onClose: () => void;
}

const Modal: React.FC<ModalProps> = ({ children, title, isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button onClick={onClose} className="close-button">&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
