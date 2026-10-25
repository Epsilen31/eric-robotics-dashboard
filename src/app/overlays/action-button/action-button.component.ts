import { Component, input } from '@angular/core';

@Component({
  selector: 'app-action-button',
  standalone: true,
  templateUrl: './action-button.component.html',
  styleUrl: './action-button.component.scss',
})
export class ActionButtonComponent {
  readonly label = input.required<string>();
}
