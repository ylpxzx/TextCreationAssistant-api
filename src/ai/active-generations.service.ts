import { Injectable } from '@nestjs/common'

@Injectable()
export class ActiveGenerationsService {
  private readonly controllers = new Map<string, AbortController>()
  add(id: string, controller: AbortController) { this.controllers.set(id, controller) }
  remove(id: string) { this.controllers.delete(id) }
  cancel(id: string) { const controller = this.controllers.get(id); controller?.abort(); return Boolean(controller) }
}
